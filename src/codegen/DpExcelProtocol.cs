/**
 * DeukPack DpExcelProtocol
 * DpProtocol implementation that reads/writes Excel data using numeric field-ID hierarchy headers.
 *
 * Excel layout (신버전 3행 헤더):
 *   Row 1: HIERARCHY_ID / FIELD_ID (numeric field IDs, dot-separated: "1", "20", "20.1", "20.2.1")
 *   Row 2: DATATYPE — 득팩 표준 타입명 (int32, list&lt;T&gt;, record, enum&lt;T&gt; 등). 레거시(i32, lst, rec) 입력 수용.
 *   Row 3: COLUMN_NAME (human-readable)
 *   Row 4+: DATA
 *
 * Structure patterns:
 *   Primitive:     col "1" (int64)  → one cell per row
 *   Struct:        col "40" (record), "40.1" (int32), "40.22.1" (string) → implicit parent inference
 *   List:          col "20" (list&lt;T&gt;), "20.1" (int32 elem) → root col has list index (0,1,2,...), multi-row
 *
 * Type handling: 모든 타입 판별은 DpTypeNames.FromProtocolName(dt) 사용. 레거시(i32/lst/rec)와 표준(int32/list/record) 동일 처리.
 * 분리 시트: ContainerSheetPolicy 단일 통로. IsContainerType / GetKindForWireType / GetSheetNamesForLookup 사용.
 */

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;

namespace DeukPack.Protocol
{
    /// <summary>Header-only tree node from Excel rows 1–3. Usable without csDeukDefine DLL.</summary>
    public class ExcelHeaderEntry
    {
        public string HierarchyId { get; set; } = "";
        public string DataType { get; set; } = "";
        public string ColumnName { get; set; } = "";
        /// <summary>1-based column index in the sheet, or -1 for implicit (no physical column).</summary>
        public int Col { get; set; }
        public List<ExcelHeaderEntry> Children { get; set; } = new List<ExcelHeaderEntry>();
    }

    /// <summary>DpSchema/Excel 헤더 공통 flat 엔트리. FlattenSchema()와 GetFlatHeaders() 모두 이 타입 반환.</summary>
    public class FlatHeaderField
    {
        public string? HierarchyId { get; set; }
        public string? DataType { get; set; }
        public string? ColumnName { get; set; }
        public string? DocComment { get; set; }
        /// <summary>Excel 시트 컬럼 위치 (1-based). DLL 스키마 유래 시 0.</summary>
        public int Col { get; set; }
        /// <summary>True if this entry is a struct grouping marker (no data, visual separator only).</summary>
        public bool IsStructMarker { get; set; }
        /// <summary>Immediate parent struct type name (e.g. "Position" for x/y/z). Null/empty for top-level fields.</summary>
        public string? ParentStructName { get; set; }
    }

    public interface IExcelSheet
    {
        string? CellValue(int row, int col);
        bool IsCellEmpty(int row, int col);
        int LastColumn { get; }
        int LastRow { get; }
        /// <summary>워크북 이름(확장자 제외). 헤더 버전(v1/v2) 판별용. 구현체가 모르면 빈 문자열.</summary>
        string? WorkbookName { get; }
        /// <summary>시트(탭) 이름. 버전 판별용. 구현체가 모르면 빈 문자열.</summary>
        string? SheetName { get; }
    }

    public interface IWritableExcelSheet : IExcelSheet
    {
        void SetCellValue(int row, int col, string? value);
        void SetCellFormula(int row, int col, string formula);
        void SetColumnNumberFormat(int col, string format);
        void SetRangeInteriorColor(int rowStart, int rowEnd, int colStart, int colEnd, int colorOle);
        void SetRangeFont(int rowStart, int rowEnd, int colStart, int colEnd, int fontColorOle, bool bold, bool italic, double fontSize);
        void SetBottomBorder(int row, int colStart, int colEnd, int colorOle);
        void AutoFitColumns(int colStart, int colEnd);
    }

    /// <summary>
    /// Provides separated container sheets (list/set/map) by sheet name.
    /// Return null if the sheet does not exist → fallback to embedded (main sheet) mode.
    /// For write: also provides a writable sheet for appending rows.
    /// </summary>
    public interface IContainerSheetResolver
    {
        /// <summary>Returns the read-only view of a container sheet, or null if not present.</summary>
        IExcelSheet? GetSheet(string sheetName);
        /// <summary>Returns the writable view of a container sheet, creating it if needed.
        /// Return null to fall back to embedded write.</summary>
        IWritableExcelSheet? GetOrCreateSheet(string sheetName, string[] headerHierarchyIds, string[] headerDataTypes, string[] headerColumnNames, string[]? headerStructNames = null);
    }

    /// <summary>
    /// 분리 시트 정책 단일 통로. 스키마에서 "표시 위치가 분리되는" 타입(List/Set/Map)과 시트 kind/이름 규칙을 한 곳에서 정의.
    /// 시트 코드 변경 시 이 정책만 수정하면 됨.
    /// </summary>
    public static class ContainerSheetPolicy
    {
        /// <summary>분리 시트를 갖는 타입. 이 타입만 별도 시트로 표시.</summary>
        public static bool IsContainerType(DpWireType wt)
        {
            return wt == DpWireType.List || wt == DpWireType.Set || wt == DpWireType.Map;
        }

        /// <summary>쓰기/신규 시트 생성 시 사용할 canonical kind (표준 표기).</summary>
        public static string? GetKindForWireType(DpWireType wt)
        {
            if (wt == DpWireType.List) return "list";
            if (wt == DpWireType.Set) return "set";
            if (wt == DpWireType.Map) return "map";
            return null;
        }

        /// <summary>시트 조회 시 시도할 kind 목록 (canonical 먼저, 레거시 호환 후).</summary>
        public static string[] GetKindVariantsForLookup(DpWireType wt)
        {
            if (wt == DpWireType.List) return new[] { "list", "lst" };
            if (wt == DpWireType.Set) return new[] { "set" };
            if (wt == DpWireType.Map) return new[] { "map" };
            return System.Array.Empty<string>();
        }

        /// <summary>파싱 시 허용할 kind 문자열. 여기만 수정하면 TryParse 동작 일괄 변경.</summary>
        public static readonly string[] ValidKindsForParsing = { "lst", "list", "set", "map" };

        public static bool IsValidKind(string kind)
        {
            if (string.IsNullOrEmpty(kind)) return false;
            string k = kind.Trim().ToLowerInvariant();
            foreach (var v in ValidKindsForParsing)
                if (k == v) return true;
            return false;
        }
    }

    /// <summary>
    /// Helpers for container sheet naming and parsing. 시트 이름/파일 이름 형식은 여기서만 정의.
    /// Sheet name format: "{fieldName}:{fieldId}"  e.g. "spawners:30.4.1" — 공간 절약, 31자 잘림 시 이름만 축약해 필드ID 유지.
    /// </summary>
    public static class ContainerSheetNaming
    {
        const int EXCEL_SHEET_NAME_MAX = 31;

        /// <summary>Build the container sheet name: "{fieldName}:{fieldId}". Excel 31자 제한 시 fieldName만 축약해 필드ID는 항상 보존.</summary>
        public static string FormatContainerSheetName(string fieldId, string kind, string fieldName)
        {
            string name = (fieldName ?? "").Trim();
            string id = (fieldId ?? "").Trim();
            string suffix = (id.Length > 0) ? ":" + id : "";
            int maxNameLen = EXCEL_SHEET_NAME_MAX - suffix.Length;
            if (maxNameLen <= 0) return suffix.Length > EXCEL_SHEET_NAME_MAX ? suffix.Substring(0, EXCEL_SHEET_NAME_MAX) : suffix;
            if (name.Length > maxNameLen) name = name.Substring(0, maxNameLen);
            return name + suffix;
        }

        /// <summary>분리 시트 조회 시 사용할 후보 시트 이름. "{fieldName}:{fieldId}" 먼저, 이어서 레거시 "fieldId kind fieldName" 순.</summary>
        public static string[] GetSheetNamesForLookup(string fieldId, DpWireType wireType, string fieldName)
        {
            var canonical = FormatContainerSheetName(fieldId, null, fieldName ?? "");
            var kinds = ContainerSheetPolicy.GetKindVariantsForLookup(wireType);
            var names = new List<string> { canonical };
            foreach (string k in kinds)
            {
                string legacy = $"{fieldId} {k} {fieldName ?? ""}".Trim();
                if (legacy.Length <= EXCEL_SHEET_NAME_MAX && !names.Contains(legacy, StringComparer.OrdinalIgnoreCase))
                    names.Add(legacy);
            }
            return names.ToArray();
        }

        static bool LooksLikeFieldId(string value)
        {
            if (string.IsNullOrEmpty(value)) return false;
            foreach (char c in value) if (c != '.' && !char.IsDigit(c)) return false;
            return true;
        }

        /// <summary>Parse container sheet name. "{fieldName}:{fieldId}" 또는 레거시 "{fieldId} {kind} {fieldName}".</summary>
        public static bool TryParseContainerSheetName(string sheetName,
            out string fieldId, out string kind, out string fieldName)
        {
            fieldId = kind = fieldName = null;
            if (string.IsNullOrWhiteSpace(sheetName)) return false;
            string s = sheetName.Trim();
            // 신규 형식: "spawners:30.4.1" — 마지막 ':' 기준으로 우측이 숫자·점이면 fieldId
            int lastColon = s.LastIndexOf(':');
            if (lastColon >= 0 && lastColon < s.Length - 1)
            {
                string right = s.Substring(lastColon + 1).Trim();
                if (LooksLikeFieldId(right))
                {
                    fieldName = s.Substring(0, lastColon).Trim();
                    fieldId = right;
                    kind = "list";
                    return true;
                }
            }
            // 레거시: "30 list spawners" 또는 이전 괄호 형식 "spawners (30.4.1)"
            int lastOpen = s.LastIndexOf(" (", StringComparison.Ordinal);
            if (lastOpen >= 0 && s.Length > lastOpen + 2 && s[s.Length - 1] == ')')
            {
                fieldName = s.Substring(0, lastOpen).Trim();
                fieldId = s.Substring(lastOpen + 2, s.Length - lastOpen - 3).Trim();
                if (LooksLikeFieldId(fieldId)) { kind = "list"; return true; }
            }
            if (s.Length > 2 && s[0] == '(' && s[s.Length - 1] == ')')
            {
                fieldId = s.Substring(1, s.Length - 2).Trim();
                if (LooksLikeFieldId(fieldId)) { fieldName = ""; kind = "list"; return true; }
            }
            var parts = s.Split(new[] { ' ' }, 3, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 3) return false;
            string k = parts[1].ToLowerInvariant();
            if (!ContainerSheetPolicy.IsValidKind(k)) return false;
            fieldId = parts[0];
            kind = k;
            fieldName = parts[2];
            return true;
        }

        /// <summary>Build container file name: "{exportBase}.{fieldId}.{kind}.{fieldName}.{ext}"</summary>
        public static string FormatContainerFileName(string exportBase, string fieldId, string kind, string fieldName, string ext)
            => $"{exportBase}.{fieldId}.{kind}.{fieldName}{ext}";

        /// <summary>
        /// Extract exportBase from a workbook filename: remove the trailing "@deuk" or "@deukpack" (compatible) suffix.
        /// e.g. "mo_map@deuk.xlsx" → "mo_map", "npc@entity@deukpack.xlsx" → "npc@entity"
        /// </summary>
        public static string GetExportBase(string workbookPath)
        {
            if (string.IsNullOrEmpty(workbookPath)) return "";
            string name = System.IO.Path.GetFileNameWithoutExtension(workbookPath);
            const string primarySuffix = "@deuk";
            const string compatibleSuffix = "@deukpack";
            if (name.EndsWith(primarySuffix, StringComparison.OrdinalIgnoreCase))
                name = name.Substring(0, name.Length - primarySuffix.Length);
            else if (name.EndsWith(compatibleSuffix, StringComparison.OrdinalIgnoreCase))
                name = name.Substring(0, name.Length - compatibleSuffix.Length);
            return name;
        }

        /// <summary>Column 1 of every separated sheet: nav-back button (value = meta_id, click to return to main sheet).</summary>
        public const string NAV_BACK_COLUMN  = "_nav";
        /// <summary>Column 2 of every separated sheet: meta_id (links back to the parent record).</summary>
        public const string META_ID_COLUMN   = "meta_id";
        /// <summary>Column 3 of every separated sheet: name (human-readable, copied from parent).</summary>
        public const string META_NAME_COLUMN = "name";

        private const string BACKUP_MARKER = "_bak_";

        /// <summary>백업 시트 명명 통일: b_원래이름_날자 (날자 = yyMMdd_HHmm). Excel 시트명 31자 제한.</summary>
        public const string BACKUP_PREFIX = "b_";
        /// <summary>백업 날자 형식. MakeBackupSheetName와 IsBackupSheet 판별에 동일 사용.</summary>
        public const string BACKUP_DATE_FORMAT = "yyMMdd_HHmm";

        /// <summary>
        /// True if the sheet name looks like a backup: contains "_bak_" (legacy) or matches b_원래이름_yyMMdd_HHmm.
        /// </summary>
        public static bool IsBackupSheet(string sheetName)
        {
            if (string.IsNullOrEmpty(sheetName)) return false;
            if (sheetName.IndexOf(BACKUP_MARKER, StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            if (sheetName.StartsWith(BACKUP_PREFIX, StringComparison.OrdinalIgnoreCase) && sheetName.Length >= 15)
            {
                string suffix = sheetName.Substring(sheetName.Length - 12);
                if (suffix.Length == 12 && suffix[0] == '_' && suffix[7] == '_')
                {
                    bool digits = true;
                    for (int i = 1; i <= 6 && digits; i++) digits = char.IsDigit(suffix[i]);
                    for (int i = 8; i <= 11 && digits; i++) digits = char.IsDigit(suffix[i]);
                    if (digits) return true;
                }
            }
            return false;
        }

        /// <summary>백업 시트 이름 생성 (통일 규칙: b_원래이름_yyMMdd_HHmm). Excel 31자 제한. existingSheetNames에 없으면 그대로, 있으면 _2, _3 붙임.</summary>
        public static string MakeBackupSheetName(string originalSheetName, System.Collections.Generic.IEnumerable<string> existingSheetNames)
        {
            const int maxLen = 31;
            string ts = System.DateTime.Now.ToString(BACKUP_DATE_FORMAT);
            int suffixLen = BACKUP_PREFIX.Length + 1 + ts.Length;
            int maxBase = Math.Max(1, maxLen - suffixLen);
            string basePart = (originalSheetName ?? "").Trim();
            if (basePart.Length > maxBase) basePart = basePart.Substring(0, maxBase);
            string candidate = BACKUP_PREFIX + basePart + "_" + ts;
            if (candidate.Length > maxLen) candidate = candidate.Substring(0, maxLen);

            var existing = new System.Collections.Generic.HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
            if (existingSheetNames != null)
            {
                foreach (string n in existingSheetNames)
                    if (!string.IsNullOrEmpty(n)) existing.Add(n);
            }
            if (existing.Count > 0 && existing.Contains(candidate))
            {
                for (int i = 2; i < 100; i++)
                {
                    string alt = candidate.Length + 2 <= maxLen ? $"{candidate}_{i}" : $"{candidate.Substring(0, maxLen - 2)}_{i}";
                    if (alt.Length > maxLen) alt = alt.Substring(0, maxLen);
                    if (!existing.Contains(alt)) { candidate = alt; break; }
                }
            }
            return candidate;
        }

        /// <summary>
        /// True if the sheet name is a separated container sheet (lst/set/map).
        /// </summary>
        public static bool IsContainerSheet(string sheetName)
        {
            return TryParseContainerSheetName(sheetName, out _, out _, out _);
        }

        /// <summary>
        /// True if the sheet is a "main content" sheet: not a backup, not a container (lst/set/map).
        /// </summary>
        public static bool IsMainContentSheet(string sheetName)
        {
            if (string.IsNullOrEmpty(sheetName)) return false;
            if (IsBackupSheet(sheetName)) return false;
            if (IsContainerSheet(sheetName)) return false;
            return true;
        }
    }

    public class DpExcelProtocol : DpProtocol
    {
        private readonly IExcelSheet _sheet;
        private int _dataRow;
        private int _maxDataRow;
        private readonly int _sheetFirstDataRow;

        // Optional resolver for separated container sheets (list/set/map)
        private readonly IContainerSheetResolver _resolver;

        // Column mapping built from Row 1 (HIERARCHY_ID)
        private readonly Dictionary<string, int> _fieldIdToCol = new Dictionary<string, int>();
        private readonly Dictionary<int, string> _colDataType = new Dictionary<int, string>();
        private readonly Dictionary<int, string> _colColumnName = new Dictionary<int, string>();

        // Struct navigation: path stack + pending fields stack
        private readonly Stack<string> _pathStack = new Stack<string>();
        private string _currentPath = "";
        private readonly Stack<StructState> _structStack = new Stack<StructState>();
        private List<FieldEntry> _pendingFields;
        private int _pendingIdx;

        // List navigation
        private readonly Stack<ListState> _listStack = new Stack<ListState>();

        // Last field returned by ReadFieldBegin (for ReadCurrentCellValue)
        private FieldEntry _lastField;

        // Row stack: save/restore _dataRow across nested structs within lists
        private readonly Stack<int> _dataRowStack = new Stack<int>();

        // Separated sheet context: when reading a struct element from a container sheet
        private IExcelSheet _currentSeparatedSheet;
        private int _currentSeparatedRow;

        private struct FieldEntry
        {
            public short Id;
            public DpWireType Type;
            public int Col;         // -1 for implicit parents
            public string Path;     // full field-ID path (e.g., "40.22")
            public string ColumnName; // human-readable name (for container sheet naming)
        }

        private struct StructState
        {
            public List<FieldEntry> Fields;
            public int Index;
        }

        private class ListState
        {
            public int StartRow;
            public int CurrentElement;
            public int Count;
            public DpWireType ElementType;
            public int RootCol;
            public string ListPath;          // field-ID path of the list root (e.g., "20")
            public int SavedDataRow;         // _dataRow before list started
            public int StructDepth;          // 0 = at list level; >0 = inside struct element(s)
            public int PrimitiveElemCol;     // for primitive lists: the child column holding the value

            // Separated sheet state (non-null when reading from a container sheet)
            public IExcelSheet SeparatedSheet;          // the container sheet (read)
            public int[] SeparatedDataRows;             // rows in container sheet for this meta_id
        }

        public const int HIERARCHY_ID_ROW = 1;
        public const int DATATYPE_ROW = 2;
        public const int COLUMN_NAME_ROW = 3;
        /// <summary>신버전 헤더 행 수(3). 헤더 고정 시 1~3행 고정.</summary>
        public const int HEADER_ROW_COUNT = 3;
        /// <summary>신버전 데이터 시작 행(4).</summary>
        public const int FIRST_DATA_ROW = 4;
        /// <summary>이전 스키마 헤더 행 수(4).</summary>
        public const int LEGACY_HEADER_ROW_COUNT = 4;
        /// <summary>이전 스키마 데이터 시작 행(5).</summary>
        public const int LEGACY_FIRST_DATA_ROW = 5;

        /// <summary>메인 시트 고정 열 이름 (1~3열). tuid 기반 테이블 기본값. keyed 테이블은 GetMainSheetFixedColumnNamesForCategory 사용.</summary>
        public static readonly string[] MainSheetFixedColumnNames = { "tuid", "tid", "name", "note" };

        /// <summary>카테고리별 메인 시트 고정 열. getKeyFieldNames가 null이면 MainSheetFixedColumnNames. keyed(키≠tuid)면 tuid 제외, 키→name→note 순.</summary>
        public static IReadOnlyList<string> GetMainSheetFixedColumnNamesForCategory(string category, Func<string, IReadOnlyList<string>> getKeyFieldNames = null)
        {
            if (string.IsNullOrEmpty(category) || getKeyFieldNames == null)
                return MainSheetFixedColumnNames;
            var keys = getKeyFieldNames(category);
            if (keys == null || keys.Count == 0)
                return MainSheetFixedColumnNames;
            bool isKeyed = !string.Equals(keys[0], "tuid", StringComparison.OrdinalIgnoreCase);
            if (!isKeyed)
                return MainSheetFixedColumnNames;
            var list = new List<string>(keys);
            if (!list.Contains("name")) list.Add("name");
            if (!list.Contains("note")) list.Add("note");
            return list;
        }

        /// <summary>워크북·시트 이름으로 v1/v2 판별 후 (데이터 시작 행, 헤더 행 수) 반환. 애드인에서 프로토콜 없이 행 정보가 필요할 때 사용.</summary>
        /// <param name="defaultMainSheetName">프로젝트 기본 메인 시트 이름(deukpack.config). 이 이름과 일치하면 v2로 간주. null이면 기존 동작(시트명 "meta"만 v2).</param>
        public static (int firstDataRow, int headerRowCount) GetLayout(string workbookNameOrPath, string sheetName = null, string defaultMainSheetName = null)
        {
            bool newVer = IsNewVersionWorkbook(workbookNameOrPath, sheetName, defaultMainSheetName);
            return (firstDataRow: GetFirstDataRow(newVer), headerRowCount: GetHeaderRowCount(newVer));
        }

        /// <summary>컨테이너(리스트) 시트의 헤더 정보: 1열이 _nav이면 (true, 2, 3), 아니면 (false, 1, 2). 메인/리스트 공통 모듈에서 한 번만 조회해 사용.</summary>
        public static (bool hasNavCol, int metaIdCol, int metaNameCol) GetContainerLayout(IExcelSheet sheet)
        {
            if (sheet == null) return (false, 1, 2);
            string col1Hier = sheet.CellValue(HIERARCHY_ID_ROW, 1)?.Trim() ?? "";
            bool hasNav = string.Equals(col1Hier, ContainerSheetNaming.NAV_BACK_COLUMN, StringComparison.OrdinalIgnoreCase);
            return hasNav ? (true, 2, 3) : (false, 1, 2);
        }

        /// <summary>v2(신규)면 true. 시트명이 defaultMainSheetName 또는 "meta"이면 v2. 워크북 파일명이 "meta"여도 v2.</summary>
        public static bool IsNewVersionWorkbook(string workbookNameOrPath, string mainSheetName = null, string defaultMainSheetName = null)
        {
            if (!string.IsNullOrWhiteSpace(mainSheetName))
            {
                var sn = mainSheetName.Trim();
                if (string.Equals(sn, "meta", StringComparison.OrdinalIgnoreCase)) return true;
                if (!string.IsNullOrWhiteSpace(defaultMainSheetName) && string.Equals(sn, defaultMainSheetName.Trim(), StringComparison.OrdinalIgnoreCase)) return true;
            }
            if (string.IsNullOrWhiteSpace(workbookNameOrPath)) return false;
            string name = System.IO.Path.GetFileNameWithoutExtension(workbookNameOrPath.Trim());
            if (string.IsNullOrEmpty(name)) return false;
            name = name.Trim();
            if (string.Equals(name, "meta", StringComparison.OrdinalIgnoreCase)) return true;
            if (!string.IsNullOrWhiteSpace(defaultMainSheetName) && string.Equals(name, defaultMainSheetName.Trim(), StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        internal static int GetFirstDataRow(bool isNewVersion) => isNewVersion ? FIRST_DATA_ROW : LEGACY_FIRST_DATA_ROW;
        internal static int GetHeaderRowCount(bool isNewVersion) => isNewVersion ? HEADER_ROW_COUNT : LEGACY_HEADER_ROW_COUNT;

        private bool _useCompactHeader;
        private readonly int _firstDataRow;
        private readonly int _headerRowCount;

        /// <summary>현재 시트의 데이터 시작 행(v1=5, v2=4). 프로토콜 내부 버전 정보 기준.</summary>
        public int FirstDataRow => _firstDataRow;
        /// <summary>현재 시트의 헤더 행 수(v1=4, v2=3). 프로토콜 내부 버전 정보 기준.</summary>
        public int HeaderRowCount => _headerRowCount;
        /// <summary>true면 v2(3행 헤더). 쓰기 시 설정 가능.</summary>
        public bool UseCompactHeader { get => _useCompactHeader; set => _useCompactHeader = value; }

        /// <summary>시트와 워크북/시트 이름으로 버전을 판별하여 행 정보를 프로토콜 내부에 보관. workbookName/sheetName이 null이면 sheet.WorkbookName/SheetName 사용. defaultMainSheetName은 애드인에서 deukpack.config 기준으로 전달.</summary>
        public DpExcelProtocol(IExcelSheet sheet, int dataRow = FIRST_DATA_ROW,
            IContainerSheetResolver resolver = null, string workbookName = null, string sheetName = null, string defaultMainSheetName = null)
        {
            _sheet = sheet ?? throw new ArgumentNullException(nameof(sheet));
            string wb = workbookName ?? sheet.WorkbookName ?? "";
            string sn = sheetName ?? sheet.SheetName ?? "";
            bool isNewVersion = IsNewVersionWorkbook(wb, sn, defaultMainSheetName);
            _useCompactHeader = isNewVersion;
            _firstDataRow = GetFirstDataRow(isNewVersion);
            _headerRowCount = GetHeaderRowCount(isNewVersion);
            _sheetFirstDataRow = _firstDataRow;
            _dataRow = dataRow;
            _maxDataRow = dataRow;
            _resolver = resolver;
            BuildColumnMap();
        }

        /// <summary>Source file path this protocol was created from. Set by caller for tracking.</summary>
        public string SourceFilePath { get; set; }

        /// <summary>
        /// Optional schema resolver for generating separated sheet headers during Write.
        /// Set before calling obj.Write() so WriteListBegin can create sheets with correct headers.
        /// </summary>
        public Func<string, DpSchema> ResolveTypeName { get; set; }

        /// <summary>
        /// Resolves meta schema name (e.g. "mo_map") to the data DpSchema for Write.
        /// Set by add-in so BeginWrite(sheet, row, metaSchemaName) can use DLL schema when name is given.
        /// </summary>
        public Func<string, DpSchema> ResolveMetaSchema { get; set; }

        /// <summary>
        /// 현재 쓰기 중인 메타 카테고리(예: "mo_skill", "level"). keyed 테이블(level 등) 시 시트에서 meta_id 제외·키 선행 정렬용.
        /// BeginWrite 전에 설정. GetKeyFieldNames와 함께 사용.
        /// </summary>
        public string WriteCategory { get; set; }

        /// <summary>
        /// 카테고리별 키 필드명 조회(예: Generated.MetaTableRegistry.GetKeyFieldNames). keyed 테이블 시 고정 열 순서·meta_id 미생성에 사용.
        /// </summary>
        public Func<string, IReadOnlyList<string>> GetKeyFieldNames { get; set; }

        /// <summary>
        /// For WriteI32: (hierarchyId) → field descriptor. Used only to detect enum and resolve display; set by add-in.
        /// </summary>
        public Func<string, object> GetFieldDescriptor { get; set; }

        /// <summary>
        /// For WriteI32: (fieldDescriptor) → "value:name" list for that enum type, or null if not enum. Set by add-in.
        /// </summary>
        public Func<object, List<string>> GetEnumValuesForField { get; set; }

        public int DataRow => _dataRow;
        /// <summary>The furthest row reached during Read(). Use to determine how many rows were consumed.</summary>
        public int MaxDataRow => _maxDataRow;
        public IExcelSheet Sheet => _sheet;
        public void SetDataRow(int row) { _dataRow = row; if (row > _maxDataRow) _maxDataRow = row; }

        /// <summary>
        /// Reset protocol navigation state for reading a new record at the given row.
        /// Reuses the existing column map (built once in the constructor).
        /// </summary>
        public void ResetForRow(int row)
        {
            _dataRow = row;
            _maxDataRow = row;
            _pathStack.Clear();
            _structStack.Clear();
            _listStack.Clear();
            _dataRowStack.Clear();
            _currentPath = "";
            _pendingFields = null;
            _pendingIdx = 0;
            _lastField = default;
            _currentSeparatedSheet = null;
            _currentSeparatedRow = 0;
        }

        /// <summary>
        /// Iterate all top-level records in this sheet.
        /// Automatically handles row advancement (including multi-row list records).
        /// The handler receives this protocol positioned at each record's start row.
        /// </summary>
        public void ForEachRecord(Action<DpExcelProtocol> handler)
        {
            int lastRow = _sheet.LastRow;
            for (int row = _sheetFirstDataRow; row <= lastRow; )
            {
                ResetForRow(row);
                handler(this);
                row = Math.Max(_maxDataRow + 1, row + 1);
            }
        }

        #region Column Map

        private readonly List<string> _diagColumnHeaders = new List<string>();

        /// <summary>Diagnostic: column headers that were read from Row 1. Use for debugging.</summary>
        public IReadOnlyList<string> DiagColumnHeaders => _diagColumnHeaders;

        private int ColumnNameRowForRead => COLUMN_NAME_ROW;

        private void BuildColumnMap()
        {
            _fieldIdToCol.Clear();
            _colDataType.Clear();
            _colColumnName.Clear();
            _diagColumnHeaders.Clear();
            int nameRow = ColumnNameRowForRead;
            for (int col = 1; col <= _sheet.LastColumn; col++)
            {
                var hier = _sheet.CellValue(HIERARCHY_ID_ROW, col)?.Trim();
                if (string.IsNullOrEmpty(hier))
                    continue;
                var dtRaw = _sheet.CellValue(DATATYPE_ROW, col)?.Trim() ?? "";
                var dtNorm = string.IsNullOrEmpty(dtRaw) ? "" : DpTypeNames.ToDisplayTypeName(dtRaw);
                var cn   = _sheet.CellValue(nameRow, col)?.Trim() ?? "";
                _fieldIdToCol[hier]  = col;
                _colDataType[col]    = dtNorm;
                _colColumnName[col]  = cn;
                _diagColumnHeaders.Add($"col{col}={hier}({dtNorm})");
            }
        }

        /// <summary>
        /// Build a tree from sheet headers (rows 1–3) only. No DLL dependency; use for display (e.g. schema tree).
        /// List/rec appear as parent nodes with children from hierarchy IDs.
        /// Sorted by column position (physical sheet order = define order).
        /// </summary>
        public List<ExcelHeaderEntry> GetHeaderTree()
        {
            var allPaths = new List<string>(_fieldIdToCol.Keys);

            var roots = new List<string>();
            foreach (var p in allPaths)
            {
                if (string.IsNullOrEmpty(p)) continue;
                if (p.IndexOf('.') < 0)
                    roots.Add(p);
            }
            roots.Sort(ComparePathByCol);

            var result = new List<ExcelHeaderEntry>();
            foreach (var path in roots)
                result.Add(BuildHeaderNode(path, allPaths));
            return result;
        }

        /// <summary>
        /// Excel 시트 헤더(Row 1–3)를 FlatHeaderField 리스트로 반환 (컬럼 물리 순서).
        /// FlattenSchema()와 동일한 형태이므로 두 결과를 직접 비교 가능.
        /// </summary>
        public List<FlatHeaderField> GetFlatHeaders()
        {
            var byCol = new List<KeyValuePair<string, int>>(_fieldIdToCol.Count);
            foreach (var kv in _fieldIdToCol)
                byCol.Add(new KeyValuePair<string, int>(kv.Key, kv.Value));
            byCol.Sort((a, b) => a.Value.CompareTo(b.Value));

            var result = new List<FlatHeaderField>(byCol.Count);
            foreach (var kv in byCol)
            {
                result.Add(new FlatHeaderField
                {
                    HierarchyId = kv.Key,
                    DataType = _colDataType.TryGetValue(kv.Value, out var dt) ? dt : "",
                    ColumnName = _sheet.CellValue(ColumnNameRowForRead, kv.Value)?.Trim() ?? "",
                    DocComment = "",
                    Col = kv.Value
                });
            }
            return result;
        }

        private int ComparePathByCol(string a, string b)
        {
            int colA = _fieldIdToCol.TryGetValue(a, out int ca) ? ca : int.MaxValue;
            int colB = _fieldIdToCol.TryGetValue(b, out int cb) ? cb : int.MaxValue;
            return colA.CompareTo(colB);
        }

        private ExcelHeaderEntry BuildHeaderNode(string path, List<string> allPaths)
        {
            int col = _fieldIdToCol.TryGetValue(path, out int c) ? c : -1;
            string dataType = col > 0 && _colDataType.TryGetValue(col, out var dt) ? dt : "";
            string columnName = col > 0 ? (_sheet.CellValue(ColumnNameRowForRead, col)?.Trim() ?? "") : "";

            var entry = new ExcelHeaderEntry
            {
                HierarchyId = path,
                DataType = dataType,
                ColumnName = columnName,
                Col = col
            };

            string prefix = path + ".";
            foreach (var p in allPaths)
            {
                if (!p.StartsWith(prefix)) continue;
                string remainder = p.Substring(prefix.Length);
                if (remainder.IndexOf('.') >= 0) continue;
                entry.Children.Add(BuildHeaderNode(p, allPaths));
            }
            entry.Children.Sort((a, b) => a.Col.CompareTo(b.Col));
            return entry;
        }

        /// <summary>
        /// Collect direct children of parentPath.
        /// Type is ALWAYS determined from DATATYPE (Row 2), not from structural position.
        /// - rec/lst/map with explicit column → type from DATATYPE
        /// - Implicit parent (no column, inferred from descendants) → Struct
        ///   (lst/map always have explicit root columns in Excel format)
        /// Explicit columns always take priority regardless of Dictionary iteration order.
        /// </summary>
        private List<FieldEntry> CollectChildFields(string parentPath)
        {
            var entries = new Dictionary<short, FieldEntry>();
            string prefix = string.IsNullOrEmpty(parentPath) ? "" : parentPath + ".";

            foreach (var kvp in _fieldIdToCol)
            {
                string path = kvp.Key;
                int col = kvp.Value;

                string remainder;
                if (!string.IsNullOrEmpty(prefix))
                {
                    if (!path.StartsWith(prefix)) continue;
                    remainder = path.Substring(prefix.Length);
                }
                else
                {
                    remainder = path;
                }

                int dotPos = remainder.IndexOf('.');
                string firstSeg = dotPos >= 0 ? remainder.Substring(0, dotPos) : remainder;
                if (!short.TryParse(firstSeg, out short fieldId)) continue;

                string childPath = string.IsNullOrEmpty(prefix) ? firstSeg : prefix + firstSeg;
                bool isExactColumn = (path == childPath);

                if (isExactColumn)
                {
                    // This column IS the direct child → type from its DATATYPE (rec, lst, map, i64, str, etc.)
                    var dt = _colDataType.ContainsKey(col) ? _colDataType[col] : "";
                    var cn = _colColumnName.ContainsKey(col) ? _colColumnName[col] : "";
                    entries[fieldId] = new FieldEntry
                    {
                        Id = fieldId,
                        Type = DataTypeToDpWireType(dt),
                        Col = col,
                        Path = childPath,
                        ColumnName = cn
                    };
                }
                else if (!entries.ContainsKey(fieldId))
                {
                    // Descendant column — check if the direct child has its own explicit column
                    if (_fieldIdToCol.TryGetValue(childPath, out int explicitCol))
                    {
                        var dt = _colDataType.ContainsKey(explicitCol) ? _colDataType[explicitCol] : "";
                        var cn = _colColumnName.ContainsKey(explicitCol) ? _colColumnName[explicitCol] : "";
                        entries[fieldId] = new FieldEntry
                        {
                            Id = fieldId,
                            Type = DataTypeToDpWireType(dt),
                            Col = explicitCol,
                            Path = childPath,
                            ColumnName = cn
                        };
                    }
                    else
                    {
                        // No explicit column: implicit parent.
                        // Lists/maps always have root columns, so this must be a struct.
                        entries[fieldId] = new FieldEntry
                        {
                            Id = fieldId,
                            Type = DpWireType.Struct,
                            Col = -1,
                            Path = childPath,
                            ColumnName = ""
                        };
                    }
                }
                // else: explicit column already recorded for this fieldId — keep it
            }

            var result = new List<FieldEntry>(entries.Values);
            result.Sort((a, b) => a.Id.CompareTo(b.Id));
            return result;
        }

        private static DpWireType DataTypeToDpWireType(string dt)
        {
            return DpTypeNames.FromProtocolName(dt);
        }

        private static string ExtractContainerElemType(string dt)
        {
            int lt = dt.IndexOf('<');
            int gt = dt.LastIndexOf('>');
            if (lt >= 0 && gt > lt)
                return dt.Substring(lt + 1, gt - lt - 1).Trim();
            return "record";
        }

        #endregion

        #region Read - Struct

        public DpRecord ReadStructBegin()
        {
            if (_listStack.Count > 0)
            {
                var ls = _listStack.Peek();
                bool isDirectListElement = (ls.StructDepth == 0);

                if (isDirectListElement)
                {
                    // Balance the pathStack: ReadFieldBegin pushes for normal struct fields,
                    // but list elements don't go through ReadFieldBegin, so push here.
                    _pathStack.Push(_currentPath);

                    if (ls.SeparatedSheet != null)
                    {
                        // Separated sheet: row comes from SeparatedDataRows
                        if (ls.SeparatedDataRows != null && ls.CurrentElement < ls.SeparatedDataRows.Length)
                            _dataRow = ls.SeparatedDataRows[ls.CurrentElement];
                    }
                    else
                    {
                        _dataRow = ls.StartRow + ls.CurrentElement;
                        if (_dataRow > _maxDataRow) _maxDataRow = _dataRow;
                    }
                    ls.CurrentElement++;
                }
                ls.StructDepth++;
            }

            if (_pendingFields != null)
                _structStack.Push(new StructState { Fields = _pendingFields, Index = _pendingIdx });

            // If inside a separated list, collect fields from the separated sheet's column map (full-path headers)
            if (_listStack.Count > 0 && _listStack.Peek().SeparatedSheet != null && _listStack.Peek().StructDepth == 1)
            {
                var ls = _listStack.Peek();
                var sepProto = new DpExcelProtocol(ls.SeparatedSheet, _dataRow);
                _pendingFields = sepProto.CollectChildFields(ls.ListPath ?? "");
                _pendingIdx = 0;
                // Remap: redirect _lastField reads to the separated sheet
                _currentSeparatedSheet = ls.SeparatedSheet;
                _currentSeparatedRow = _dataRow;
            }
            else
            {
                _pendingFields = CollectChildFields(_currentPath);
                _pendingIdx = 0;
            }

            return new DpRecord("struct");
        }

        public void ReadStructEnd()
        {
            if (_listStack.Count > 0)
                _listStack.Peek().StructDepth--;

            // Clear separated sheet context when leaving the struct
            if (_listStack.Count == 0 || _listStack.Peek().StructDepth == 0)
            {
                _currentSeparatedSheet = null;
                _currentSeparatedRow = 0;
            }

            if (_pathStack.Count > 0)
                _currentPath = _pathStack.Pop();
            if (_structStack.Count > 0)
            {
                var s = _structStack.Pop();
                _pendingFields = s.Fields;
                _pendingIdx = s.Index;
            }
        }

        public DpColumn ReadFieldBegin()
        {
            while (_pendingIdx < _pendingFields.Count)
            {
                var entry = _pendingFields[_pendingIdx];
                _pendingIdx++;

                // Skip empty primitives
                if (entry.Type != DpWireType.Struct && entry.Type != DpWireType.List &&
                    entry.Type != DpWireType.Map && entry.Type != DpWireType.Set)
                {
                    if (entry.Col <= 0 || _sheet.IsCellEmpty(_dataRow, entry.Col))
                        continue;
                }

                // Skip structs with no child data
                if (entry.Type == DpWireType.Struct && !HasAnyChildData(entry.Path))
                    continue;

                // Skip lists with no elements
                if (entry.Type == DpWireType.List && CountListElements(entry) == 0)
                    continue;

                _lastField = entry;

                // For struct, push path navigation
                if (entry.Type == DpWireType.Struct)
                {
                    _pathStack.Push(_currentPath);
                    _currentPath = entry.Path;
                }

                return new DpColumn(entry.Path, entry.Type, entry.Id);
            }

            return new DpColumn("", DpWireType.Stop, 0);
        }

        public void ReadFieldEnd() { }

        private bool HasAnyChildData(string parentPath)
        {
            string prefix = parentPath + ".";
            foreach (var kvp in _fieldIdToCol)
            {
                if (!kvp.Key.StartsWith(prefix)) continue;

                if (_colDataType.TryGetValue(kvp.Value, out var dt) &&
                    DpTypeNames.IsContainerType(DpTypeNames.FromProtocolName(dt)))
                    continue;

                if (!_sheet.IsCellEmpty(_dataRow, kvp.Value))
                    return true;
            }
            return false;
        }

        #endregion

        #region Read - List

        /// <summary>
        /// Count list elements starting from _dataRow.
        /// A list element = a row where either:
        ///   - The list root column has a non-empty index value, OR
        ///   - Any child column of the list has data (same meta_id)
        /// Ends when: different meta_id, or gap row with no data in list columns.
        /// </summary>
        private int CountListElements(FieldEntry listField)
        {
            int rootCol = listField.Col;
            string listPath = listField.Path;
            string prefix = listPath + ".";
            int count = 0;
            string metaId = _sheet.CellValue(_dataRow, 1) ?? "";

            for (int r = _dataRow; r <= _sheet.LastRow; r++)
            {
                // Different meta_id = new record, stop
                if (r > _dataRow)
                {
                    var rid = _sheet.CellValue(r, 1) ?? "";
                    if (!string.IsNullOrEmpty(rid) && rid != metaId)
                        break;
                }

                bool hasData = false;
                // Check root column (list index)
                if (rootCol > 0 && !_sheet.IsCellEmpty(r, rootCol))
                    hasData = true;

                // Check child columns
                if (!hasData)
                {
                    foreach (var kvp in _fieldIdToCol)
                    {
                        if (kvp.Key.StartsWith(prefix) && !_sheet.IsCellEmpty(r, kvp.Value))
                        {
                            hasData = true;
                            break;
                        }
                    }
                }

                if (hasData) count++;
                else if (count > 0) break; // gap = end
            }
            return count;
        }

        /// <summary>
        /// Determine list element type from DATATYPE + child column structure.
        /// Priority: explicit &lt;type&gt; in root datatype → child column DATATYPE analysis.
        /// </summary>
        private DpWireType InferListElementType(FieldEntry listEntry)
        {
            var dt = (listEntry.Col > 0 && _colDataType.ContainsKey(listEntry.Col))
                ? _colDataType[listEntry.Col] : "list";

            // 1) Explicit element type in DATATYPE (e.g., "lst<i64>", "lst<rec>")
            int lt = dt.IndexOf('<');
            if (lt >= 0)
            {
                var inner = ExtractContainerElemType(dt);
                return DataTypeToDpWireType(inner);
            }

            // 2) Infer from direct children using their DATATYPE
            string prefix = listEntry.Path + ".";
            var childIds = new Dictionary<short, (string dt, int col, string path)>();

            foreach (var kvp in _fieldIdToCol)
            {
                if (!kvp.Key.StartsWith(prefix)) continue;
                string remainder = kvp.Key.Substring(prefix.Length);
                int dotPos = remainder.IndexOf('.');
                string firstSeg = dotPos >= 0 ? remainder.Substring(0, dotPos) : remainder;
                if (!short.TryParse(firstSeg, out short fid)) continue;

                string childPath = listEntry.Path + "." + firstSeg;
                bool isExactChild = (kvp.Key == childPath);

                if (isExactChild)
                {
                    // Exact child column: its DATATYPE is authoritative
                    string childDt = _colDataType.ContainsKey(kvp.Value) ? _colDataType[kvp.Value] : "";
                    childIds[fid] = (childDt, kvp.Value, childPath);
                }
                else if (!childIds.ContainsKey(fid))
                {
                    // Descendant: check if the direct child has an explicit column
                    if (_fieldIdToCol.TryGetValue(childPath, out int explicitCol))
                    {
                        string childDt = _colDataType.ContainsKey(explicitCol) ? _colDataType[explicitCol] : "";
                        childIds[fid] = (childDt, explicitCol, childPath);
                    }
                    else
                    {
                        childIds[fid] = ("record", -1, childPath); // implicit struct child
                    }
                }
            }

            if (childIds.Count == 0) return DpWireType.Struct;

            // Single direct child whose DATATYPE is a primitive → primitive list
            if (childIds.Count == 1)
            {
                foreach (var c in childIds.Values)
                {
                    var childDpWireType = DataTypeToDpWireType(c.dt);
                    bool isPrimitive = (childDpWireType != DpWireType.Struct && childDpWireType != DpWireType.List &&
                                        childDpWireType != DpWireType.Map && childDpWireType != DpWireType.Set);
                    if (isPrimitive) return childDpWireType;
                }
            }

            // Multiple children or container child → struct element
            return DpWireType.Struct;
        }

        public DpList ReadListBegin()
        {
            var entry = _lastField;

            // ── Separated sheet mode (정책에서 시트 이름 후보 조회) ─────────────────────
            if (_resolver != null)
            {
                var namesToTry = ContainerSheetNaming.GetSheetNamesForLookup(entry.Path, DpWireType.List, entry.ColumnName);
                foreach (var sheetName in namesToTry)
                {
                    var sepSheet = _resolver.GetSheet(sheetName);
                    if (sepSheet != null)
                        return ReadListBeginFromSeparatedSheet(entry, sepSheet, ContainerSheetPolicy.GetKindForWireType(DpWireType.List));
                }
            }

            // ── Embedded (original) mode ──────────────────────────────────────
            var elemDpWireType = InferListElementType(entry);
            int count = CountListElements(entry);

            // For primitive lists, find the child element column
            int primitiveElemCol = -1;
            if (elemDpWireType != DpWireType.Struct)
            {
                string prefix = entry.Path + ".";
                foreach (var kvp in _fieldIdToCol)
                {
                    if (kvp.Key.StartsWith(prefix))
                    {
                        primitiveElemCol = kvp.Value;
                        break;
                    }
                }
            }

            var state = new ListState
            {
                StartRow = _dataRow,
                CurrentElement = 0,
                Count = count,
                ElementType = elemDpWireType,
                RootCol = entry.Col,
                ListPath = entry.Path,
                SavedDataRow = _dataRow,
                PrimitiveElemCol = primitiveElemCol
            };
            _listStack.Push(state);

            // For primitive lists, redirect _lastField to the element column
            if (primitiveElemCol > 0)
                _lastField = new FieldEntry { Id = 0, Type = elemDpWireType, Col = primitiveElemCol, Path = entry.Path };

            // Push path for list children
            _pathStack.Push(_currentPath);
            _currentPath = entry.Path;

            return new DpList { ElementType = elemDpWireType, Count = count };
        }

        /// <summary>
        /// Read list elements from a separated container sheet.
        /// Rows whose meta_id matches the current record's meta_id (col 1 of main sheet) are used.
        /// Empty-element rows (all element cols empty) are treated as an empty list placeholder.
        /// </summary>
        private DpList ReadListBeginFromSeparatedSheet(FieldEntry entry, IExcelSheet sepSheet, string kind)
        {
            string metaId = _sheet.CellValue(_dataRow, 1) ?? "";

            // Detect meta_id column dynamically: new layout has _nav in col 1 → meta_id in col 2;
            // old layout has meta_id directly in col 1.
            int metaIdCol = 1;
            int firstElemCol = 4;
            string col1Hier = sepSheet.CellValue(HIERARCHY_ID_ROW, 1)?.Trim() ?? "";
            if (string.Equals(col1Hier, ContainerSheetNaming.NAV_BACK_COLUMN, StringComparison.OrdinalIgnoreCase))
            {
                metaIdCol = 2;
                firstElemCol = 4;
            }
            else
            {
                metaIdCol = 1;
                firstElemCol = 3;
            }

            var matchingRows = new List<int>();
            for (int r = _sheetFirstDataRow; r <= sepSheet.LastRow; r++)
            {
                string rid = ParseMetaIdFromListCell(sepSheet.CellValue(r, metaIdCol)?.Trim() ?? "");
                if (rid == metaId)
                    matchingRows.Add(r);
            }

            var sepProto = new DpExcelProtocol(sepSheet, _sheetFirstDataRow);
            DpWireType elemDpWireType = DpWireType.Struct;
            bool allElemEmpty = true;
            if (matchingRows.Count > 0)
            {
                for (int r = 0; r < matchingRows.Count && allElemEmpty; r++)
                {
                    for (int c = firstElemCol; c <= sepSheet.LastColumn; c++)
                    {
                        if (!sepSheet.IsCellEmpty(matchingRows[r], c)) { allElemEmpty = false; break; }
                    }
                }
            }

            int count = (matchingRows.Count == 0 || allElemEmpty) ? 0 : matchingRows.Count;

            elemDpWireType = sepProto.InferSeparatedListElementType();

            int primitiveElemCol = -1;
            if (elemDpWireType != DpWireType.Struct && sepSheet.LastColumn >= firstElemCol)
                primitiveElemCol = firstElemCol;

            var state = new ListState
            {
                StartRow = matchingRows.Count > 0 ? matchingRows[0] : _sheetFirstDataRow,
                CurrentElement = 0,
                Count = count,
                ElementType = elemDpWireType,
                RootCol = entry.Col,
                ListPath = entry.Path,
                SavedDataRow = _dataRow,
                PrimitiveElemCol = primitiveElemCol,
                SeparatedSheet = sepSheet,
                SeparatedDataRows = matchingRows.ToArray()
            };
            _listStack.Push(state);

            if (primitiveElemCol > 0)
                _lastField = new FieldEntry { Id = 0, Type = elemDpWireType, Col = primitiveElemCol, Path = entry.Path };

            _pathStack.Push(_currentPath);
            _currentPath = entry.Path;

            return new DpList { ElementType = elemDpWireType, Count = count };
        }

        /// <summary>
        /// Infer list element type for a separated sheet.
        /// The sheet's first column after tuid/name (col 3+) determines the type.
        /// </summary>
        private DpWireType InferSeparatedListElementType()
        {
            if (_sheet.LastColumn < 3) return DpWireType.Struct;

            string commonPrefix = null;
            foreach (var kv in _fieldIdToCol)
            {
                if (string.Equals(kv.Key, ContainerSheetNaming.NAV_BACK_COLUMN, StringComparison.OrdinalIgnoreCase)) continue;
                if (string.Equals(kv.Key, ContainerSheetNaming.META_ID_COLUMN, StringComparison.OrdinalIgnoreCase)) continue;
                if (string.Equals(kv.Key, ContainerSheetNaming.META_NAME_COLUMN, StringComparison.OrdinalIgnoreCase)) continue;
                if (kv.Key == "value") continue;

                if (commonPrefix == null) { commonPrefix = kv.Key; continue; }
                int minLen = Math.Min(commonPrefix.Length, kv.Key.Length);
                int match = 0;
                for (int i = 0; i < minLen; i++)
                {
                    if (commonPrefix[i] == kv.Key[i]) match++;
                    else break;
                }
                commonPrefix = commonPrefix.Substring(0, match);
            }

            if (string.IsNullOrEmpty(commonPrefix)) return DpWireType.Struct;
            // Trim to last complete segment boundary
            int lastDot = commonPrefix.LastIndexOf('.');
            string listPath = lastDot > 0 ? commonPrefix.Substring(0, lastDot) : "";

            // Count direct children under listPath
            string prefix = string.IsNullOrEmpty(listPath) ? "" : listPath + ".";
            var directChildren = new HashSet<string>();
            foreach (var kv in _fieldIdToCol)
            {
                if (string.Equals(kv.Key, ContainerSheetNaming.META_ID_COLUMN, StringComparison.OrdinalIgnoreCase)) continue;
                if (string.Equals(kv.Key, ContainerSheetNaming.META_NAME_COLUMN, StringComparison.OrdinalIgnoreCase)) continue;
                string remainder = !string.IsNullOrEmpty(prefix) && kv.Key.StartsWith(prefix)
                    ? kv.Key.Substring(prefix.Length)
                    : (string.IsNullOrEmpty(prefix) ? kv.Key : null);
                if (remainder == null) continue;
                int dot = remainder.IndexOf('.');
                string firstSeg = dot >= 0 ? remainder.Substring(0, dot) : remainder;
                directChildren.Add(firstSeg);
            }

            if (directChildren.Count == 1)
            {
                string childSeg = null;
                foreach (var s in directChildren) { childSeg = s; break; }
                string childPath = string.IsNullOrEmpty(prefix) ? childSeg : prefix + childSeg;
                if (_fieldIdToCol.TryGetValue(childPath, out int col))
                {
                    string dt = _colDataType.ContainsKey(col) ? _colDataType[col] : "";
                    var tt = DataTypeToDpWireType(dt);
                    if (tt != DpWireType.Struct && tt != DpWireType.List && tt != DpWireType.Map && tt != DpWireType.Set)
                        return tt;
                }
            }
            return DpWireType.Struct;
        }

        public void ReadListEnd()
        {
            if (_listStack.Count > 0)
            {
                var state = _listStack.Pop();
                // Restore _dataRow: for the caller, _dataRow should still be on the original record row
                // But if this is within a ReadFromExcelDirect loop, the caller advances rows
                _dataRow = state.SavedDataRow;
            }
            // Pop the list path
            if (_pathStack.Count > 0)
                _currentPath = _pathStack.Pop();
        }

        /// <summary>
        /// For primitive list elements: advance _dataRow to the next element row.
        /// Only triggers when inside a list AND the current path matches the list path
        /// (struct elements are advanced in ReadStructBegin instead).
        /// </summary>
        private void AdvanceListElementIfPrimitive()
        {
            if (_listStack.Count == 0) return;
            var state = _listStack.Peek();
            // Only advance for primitive list elements (StructDepth==0 means not inside a struct)
            if (state.StructDepth > 0) return;

            if (state.SeparatedSheet != null)
            {
                // Separated sheet: index into SeparatedDataRows
                if (state.SeparatedDataRows != null && state.CurrentElement < state.SeparatedDataRows.Length)
                    _dataRow = state.SeparatedDataRows[state.CurrentElement];
                state.CurrentElement++;
            }
            else
            {
                _dataRow = state.StartRow + state.CurrentElement;
                if (_dataRow > _maxDataRow) _maxDataRow = _dataRow;
                state.CurrentElement++;
            }
        }

        #endregion

        #region Read - Primitives

        public bool ReadBool()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            if (string.IsNullOrEmpty(val)) return false;
            if (val == "1") return true;
            if (val == "0") return false;
            bool.TryParse(val, out bool bv);
            return bv;
        }

        public byte ReadByte()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            if (string.IsNullOrEmpty(val)) return 0;
            byte.TryParse(val.Split(':')[0].Trim(), out byte r);
            return r;
        }

        public short ReadI16()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            if (string.IsNullOrEmpty(val)) return 0;
            short.TryParse(val.Split(':')[0].Trim(), out short r);
            return r;
        }

        public int ReadI32()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            if (string.IsNullOrEmpty(val)) return 0;
            var token = val.Split(':')[0].Trim();
            if (int.TryParse(token, out int r))
                return r;
            // Enum string name → resolve via DATATYPE "enum<ns.EnumType>"
            return ResolveEnumName(token);
        }

        public long ReadI64()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            if (string.IsNullOrEmpty(val)) return 0L;
            var parts = val.Split(':');
            long.TryParse(parts[0].Trim(), out long r);
            return r;
        }

        public double ReadDouble()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            double.TryParse(val, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out double r);
            return r;
        }

        public string ReadString()
        {
            AdvanceListElementIfPrimitive();
            return ReadCurrentCellValue()?.Trim() ?? "";
        }

        public byte[] ReadBinary()
        {
            AdvanceListElementIfPrimitive();
            var val = ReadCurrentCellValue();
            return string.IsNullOrEmpty(val) ? Array.Empty<byte>() : Encoding.UTF8.GetBytes(val);
        }

        public DpSet ReadSetBegin()
        {
            var entry = _lastField;

            // Try separated sheet (정책에서 시트 이름 조회)
            if (_resolver != null)
            {
                var namesToTry = ContainerSheetNaming.GetSheetNamesForLookup(entry.Path, DpWireType.Set, entry.ColumnName);
                foreach (var sheetName in namesToTry)
                {
                    var sepSheet = _resolver.GetSheet(sheetName);
                    if (sepSheet != null)
                    {
                        var tl = ReadListBeginFromSeparatedSheet(entry, sepSheet, ContainerSheetPolicy.GetKindForWireType(DpWireType.Set));
                        return new DpSet { ElementType = tl.ElementType, Count = tl.Count };
                    }
                }
            }

            var lb = ReadListBegin();
            return new DpSet { ElementType = lb.ElementType, Count = lb.Count };
        }

        public void ReadSetEnd() { ReadListEnd(); }

        public DpDict ReadMapBegin()
        {
            return new DpDict { KeyType = DpWireType.Int64, ValueType = DpWireType.Struct, Count = 0 };
        }

        public void ReadMapEnd() { }

        private string ReadCurrentCellValue()
        {
            if (_lastField.Col <= 0) return "";
            // If reading from a separated container sheet struct element, use that sheet
            if (_currentSeparatedSheet != null)
                return _currentSeparatedSheet.CellValue(_currentSeparatedRow, _lastField.Col) ?? "";
            return _sheet.CellValue(_dataRow, _lastField.Col) ?? "";
        }

        /// <summary>
        /// Resolve enum string name to integer value.
        /// Uses the column's DATATYPE "enum&lt;ns.EnumType&gt;" to find the CLR enum type via reflection.
        /// </summary>
        private int ResolveEnumName(string name)
        {
            if (_lastField.Col <= 0) return 0;
            if (!_colDataType.TryGetValue(_lastField.Col, out var dt)) return 0;
            var enumTypeName = ExtractContainerElemType(dt);
            if (string.IsNullOrEmpty(enumTypeName) || enumTypeName == "rec" || enumTypeName == "record") return 0;

            // Search loaded assemblies for the enum type
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                foreach (var t in asm.GetTypes())
                {
                    if (!t.IsEnum) continue;
                    if (t.Name == enumTypeName || t.FullName == enumTypeName ||
                        t.FullName?.EndsWith("." + enumTypeName) == true)
                    {
                        try
                        {
                            var v = Enum.Parse(t, name, true);
                            return Convert.ToInt32(v);
                        }
                        catch (ArgumentException) { }
                    }
                }
            }
            return 0;
        }

        #endregion

        #region Write

        private IWritableExcelSheet _writeSheet;
        private int _writeRow;
        private int _maxWriteRow;
        private string _writeCurrentPath = "";
        private readonly Stack<string> _writePathStack = new Stack<string>();
        private DpColumn _writeCurrentField;
        private DpSchema _writeSchema;

        private class WriteListState
        {
            public int StartRow;
            public int CurrentElement;
            public string ListPath;
            public int StructDepth;
            public bool IsPrimitiveList;
            public int PrimitiveElemCol;

            // Separated sheet write state
            public IWritableExcelSheet SeparatedSheet;  // non-null when writing to a container sheet
            public string SeparatedSheetName;           // sheet name for merge tracking in FinishWrite
            public string SeparatedMetaId;              // meta_id value to write in col 1
            public string SeparatedMetaName;            // name value to write in col 2
            public int MainSheetRow;                    // _writeRow before entering separated list
            public int MainSheetMaxRow;                 // _maxWriteRow before entering separated list
        }
        private readonly Stack<WriteListState> _writeListStack = new Stack<WriteListState>();
        private int _mainSheetFirstDataRow = FIRST_DATA_ROW;
        private int _globalFirstDataRow = FIRST_DATA_ROW;
        private int _globalMaxWriteRow = FIRST_DATA_ROW;
        private readonly List<(string sheetName, int firstRow, int lastRow, int colCount)> _containerSheetsWritten = new List<(string, int, int, int)>();
        /// <summary>Per container sheet name: last data row written. Used to compute append row for next record (avoids stale UsedRange).</summary>
        private readonly Dictionary<string, int> _containerSheetLastRow = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private IExcelSheet _cachedSepSheet;
        private DpExcelProtocol _cachedSepProto;

        /// <summary>
        /// Enable write mode. Call before Write() on an IDeukPack object.
        /// metaSchemaName: when non-null, use DLL schema (ResolveMetaSchema) for column mapping; otherwise use sheet headers.
        /// When writeHeaders is true, the schema-derived column map is physically written to the sheet (rows 1–3).
        /// For keyed tables (e.g. level): set WriteCategory and GetKeyFieldNames before calling so meta_id is omitted and columns order key→name→note.
        /// </summary>
        public void BeginWrite(IWritableExcelSheet sheet, int startRow = FIRST_DATA_ROW, string metaSchemaName = null, bool writeHeaders = false)
        {
            _writeSheet = sheet ?? throw new ArgumentNullException(nameof(sheet));
            _writeRow = startRow;
            _maxWriteRow = startRow;
            _mainSheetFirstDataRow = startRow;
            _writeCurrentPath = "";
            _writePathStack.Clear();
            _writeListStack.Clear();
            if (writeHeaders)
            {
                _globalFirstDataRow = startRow;
                _globalMaxWriteRow = startRow;
                _containerSheetsWritten.Clear();
                _containerSheetLastRow.Clear();
            }
            else
            {
                _globalMaxWriteRow = Math.Max(_globalMaxWriteRow, _maxWriteRow);
            }

            DpSchema schema = null;
            if (!string.IsNullOrEmpty(metaSchemaName))
                schema = ResolveMetaSchema?.Invoke(metaSchemaName);
            _writeSchema = schema;

            if (schema != null)
            {
                BuildColumnMapFromSchema(schema);
                if (writeHeaders)
                {
                    WriteHeadersToSheet(sheet);
                    EnsureContainerSheetsExist();
                    ApplyHeaderStyles(sheet, _writeFlatFields);
                }
            }
        }

        /// <summary>
        /// Create empty container sheets for all list/set/map fields so that console Write matches add-in.
        /// Uses _writeFlatFields, _resolver, BuildContainerSheetHeaders; applies meta_id col NumberFormat "0".
        /// </summary>
        private void EnsureContainerSheetsExist()
        {
            if (_writeFlatFields == null || _resolver == null) return;
            foreach (var f in _writeFlatFields)
            {
                string dt = (f.DataType ?? "").Trim();
                var wt = DpTypeNames.FromProtocolName(dt);
                if (!ContainerSheetPolicy.IsContainerType(wt)) continue;

                string kind = ContainerSheetPolicy.GetKindForWireType(wt);
                if (string.IsNullOrEmpty(kind)) continue;
                string sheetName = ContainerSheetNaming.FormatContainerSheetName(f.HierarchyId, kind, f.ColumnName ?? "");

                string innerType = ResolveElementTypeNameFromSchema(f.HierarchyId);
                if (string.IsNullOrEmpty(innerType)) innerType = DpTypeNames.StripOuterGeneric(dt);
                DpWireType elemType = (ResolveTypeName != null && !string.IsNullOrEmpty(innerType) && ResolveTypeName(innerType) != null)
                    ? DpWireType.Struct
                    : DpTypeNames.FromProtocolName(innerType ?? "");

                BuildContainerSheetHeaders(f.HierarchyId, elemType, out string[] hdrIds, out string[] hdrTypes, out string[] hdrNames, out string[] hdrStructNames, out bool[] hdrIsMarker);
                if (hdrIds == null) continue;

                var sepSheet = _resolver.GetOrCreateSheet(sheetName, hdrIds, hdrTypes, hdrNames,
                    _useCompactHeader ? hdrStructNames : null);
                if (sepSheet != null)
                {
                    sepSheet.SetColumnNumberFormat(1, "0");
                    sepSheet.SetColumnNumberFormat(2, "@");
                    var listFlat = HeaderArraysToFlatFields(hdrIds, hdrTypes, hdrNames, hdrStructNames, hdrIsMarker);
                    ApplyHeaderStyles(sepSheet, listFlat);
                }
            }
        }

        /// <summary>
        /// Build column mapping directly from the DpSchema via FlattenSchema.
        /// When WriteCategory and GetKeyFieldNames are set: keyed tables exclude meta_id column and order key→name→note.
        /// </summary>
        private void BuildColumnMapFromSchema(DpSchema schema)
        {
            _fieldIdToCol.Clear();
            _colDataType.Clear();
            _colColumnName.Clear();

            var fullFlat = FlattenSchema(schema, ResolveTypeName, "", mainSheetOnly: true);
            if (!string.IsNullOrEmpty(WriteCategory) && GetKeyFieldNames != null)
            {
                var fixedNames = GetMainSheetFixedColumnNamesForCategory(WriteCategory, GetKeyFieldNames);
                bool isKeyed = fixedNames != null && fixedNames.Count > 0 &&
                    !string.Equals(fixedNames[0], "tuid", StringComparison.OrdinalIgnoreCase);
                if (isKeyed)
                {
                    fullFlat = fullFlat.Where(f => !string.Equals(f.ColumnName, "meta_id", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(f.ColumnName, "tuid", StringComparison.OrdinalIgnoreCase)).ToList();
                }
                fullFlat = ReorderFlatWithMetaIdTidMetaNameFirst(fullFlat, WriteCategory, GetKeyFieldNames);
            }
            for (int i = 0; i < fullFlat.Count; i++)
            {
                int col = i + 1;
                var f = fullFlat[i];
                _fieldIdToCol[f.HierarchyId] = col;
                _colDataType[col] = f.DataType ?? "";
                _colColumnName[col] = f.ColumnName ?? "";
            }
            _writeFlatFields = fullFlat;
            _writeStructRanges = null;
        }

        private static List<(int colStart, int colEnd, string structName)> BuildStructRangesForCompact(List<FlatHeaderField> fullFlat)
        {
            var list = new List<(int, int, string)>();
            int dataCol = 0;
            string currentStruct = null;
            int runStart = 0;
            for (int i = 0; i < fullFlat.Count; i++)
            {
                if (fullFlat[i].IsStructMarker)
                {
                    if (currentStruct != null && runStart > 0)
                        list.Add((runStart, dataCol, currentStruct));
                    string tn = fullFlat[i].DataType?.Trim();
                    currentStruct = (!string.IsNullOrEmpty(tn) && !string.Equals(tn, "rec", StringComparison.OrdinalIgnoreCase) && !string.Equals(tn, "record", StringComparison.OrdinalIgnoreCase))
                        ? tn : (fullFlat[i].ColumnName?.Trim() ?? "");
                    runStart = dataCol + 1;
                }
                else
                {
                    dataCol++;
                }
            }
            if (currentStruct != null && runStart > 0)
                list.Add((runStart, dataCol, currentStruct));
            return list;
        }

        private List<FlatHeaderField> _writeFlatFields;
#pragma warning disable CS0414
        private List<(int colStart, int colEnd, string structName)> _writeStructRanges;
#pragma warning restore CS0414

        private const int STRUCT_NAME_ROW_COMPACT = 3;
        private const int VARIABLE_NAME_ROW_COMPACT = 4;

        /// <summary>
        /// Physically write header rows to the given sheet from the current column map.
        /// 신버전 3행: Row 1 = HierarchyId, Row 2 = DataType, Row 3 = ColumnName.
        /// </summary>
        private void WriteHeadersToSheet(IWritableExcelSheet sheet)
        {
            if (_writeFlatFields == null) return;

            for (int i = 0; i < _writeFlatFields.Count; i++)
            {
                int col = i + 1;
                var f = _writeFlatFields[i];
                sheet.SetCellValue(HIERARCHY_ID_ROW, col, f.HierarchyId);
                sheet.SetCellValue(DATATYPE_ROW, col, f.DataType ?? "");
                string nameRow3 = f.ColumnName ?? "";
                if (string.IsNullOrWhiteSpace(nameRow3) && f.IsStructMarker)
                    nameRow3 = f.ParentStructName ?? f.HierarchyId ?? "";
                sheet.SetCellValue(COLUMN_NAME_ROW, col, nameRow3 ?? "");
            }

            for (int c = 1; c <= _writeFlatFields.Count; c++)
            {
                string dt = (_writeFlatFields[c - 1].DataType ?? "").Trim();
                var wt = DpTypeNames.FromProtocolName(dt);
                if (wt == DpWireType.Int64 || wt == DpWireType.Int32 || wt == DpWireType.Int16 || wt == DpWireType.Byte)
                    sheet.SetColumnNumberFormat(c, "0");
            }
        }

        /// <summary>The highest row written so far. Use to determine how many rows were consumed.</summary>
        public int WriteRow => _maxWriteRow;

        /// <summary>
        /// Call after all records have been written. Applies data row stripes to main sheet and to each written container sheet.
        /// Console Write must call this to get the same result as add-in.
        /// </summary>
        public void FinishWrite()
        {
            if (_writeSheet == null || _writeFlatFields == null) return;
            _globalMaxWriteRow = Math.Max(_globalMaxWriteRow, _maxWriteRow);
            int colCount = _writeFlatFields.Count;
            if (colCount > 0 && _globalMaxWriteRow >= _globalFirstDataRow)
                ApplyDataStripes(_writeSheet, _globalFirstDataRow, _globalMaxWriteRow, colCount, _writeFlatFields);
            // Merge ranges per sheet name so meta_id grouping colors all groups across all records
            var byName = new Dictionary<string, (int firstRow, int lastRow, int cols)>(StringComparer.OrdinalIgnoreCase);
            foreach (var (sheetName, firstRow, lastRow, cols) in _containerSheetsWritten)
            {
                if (string.IsNullOrEmpty(sheetName) || cols < 1) continue;
                if (byName.TryGetValue(sheetName, out var existing))
                {
                    int mergedFirst = Math.Min(existing.firstRow, firstRow);
                    int mergedLast = Math.Max(existing.lastRow, lastRow);
                    byName[sheetName] = (mergedFirst, mergedLast, Math.Max(existing.cols, cols));
                }
                else
                    byName[sheetName] = (firstRow, lastRow, cols);
            }
            foreach (var kv in byName)
            {
                var (firstRow, lastRow, cols) = kv.Value;
                if (lastRow < firstRow) continue;
                // Get fresh writable adapter with current LastRow/LastColumn
                var freshSheet = _resolver?.GetOrCreateSheet(kv.Key, null, null, null);
                if (freshSheet != null)
                    ApplyContainerDataStripes(freshSheet, firstRow, lastRow, cols);
            }
        }

        #region Excel styling (header colors + data stripes; same result as add-in)

        private static int ToOle(int r, int g, int b) => (r & 0xFF) | ((g & 0xFF) << 8) | ((b & 0xFF) << 16);
        private static int Lighten(int ole, float amount)
        {
            int r = (ole & 0xFF) + (int)((255 - (ole & 0xFF)) * amount);
            int g = ((ole >> 8) & 0xFF) + (int)((255 - ((ole >> 8) & 0xFF)) * amount);
            int b = ((ole >> 16) & 0xFF) + (int)((255 - ((ole >> 16) & 0xFF)) * amount);
            return ToOle(Math.Min(r, 255), Math.Min(g, 255), Math.Min(b, 255));
        }
        private static int Darken(int ole, float amount)
        {
            int r = (ole & 0xFF) - (int)((ole & 0xFF) * amount);
            int g = ((ole >> 8) & 0xFF) - (int)(((ole >> 8) & 0xFF) * amount);
            int b = ((ole >> 16) & 0xFF) - (int)(((ole >> 16) & 0xFF) * amount);
            return ToOle(Math.Max(0, r), Math.Max(0, g), Math.Max(0, b));
        }
        private static readonly int ColHdrPrimitive = ToOle(240, 253, 244);
        private static readonly int ColHdrStruct = ToOle(238, 242, 255);
        private static readonly int ColHdrList = ToOle(255, 250, 235);
        private static readonly int ColHdrMap = ToOle(245, 243, 255);
        private static readonly int ColHdrEnum = ToOle(255, 241, 242);
        private static readonly int ColHdrLink = ToOle(236, 254, 255);
        private static readonly int ColHdrRow3Base = ToOle(51, 65, 85);
        private static readonly int ColHdrRow3Struct = ToOle(49, 46, 129);
        private static readonly int ColHdrRow3List = ToOle(180, 83, 9);
        private static readonly int ColHdrRow3Map = ToOle(91, 33, 182);
        private static readonly int ColHdrRow3Enum = ToOle(157, 23, 77);
        private static readonly int ColHdrRow3Link = ToOle(21, 94, 117);
        private static readonly int FontGray1 = ToOle(120, 120, 120);
        private static readonly int FontGray2 = ToOle(130, 130, 130);
        private static readonly int FontWhite = ToOle(255, 255, 255);
        private static readonly int FontGray4 = ToOle(160, 160, 160);

        private static void ClassifyColumnColor(string dt, FlatHeaderField field, out int pastelOle, out int row3Ole)
        {
            if (field != null && field.IsStructMarker)
            { pastelOle = ColHdrStruct; row3Ole = ColHdrRow3Struct; return; }
            string lower = (dt ?? "").ToLowerInvariant();
            if (lower.StartsWith("enum", StringComparison.Ordinal))
            { pastelOle = ColHdrEnum; row3Ole = ColHdrRow3Enum; return; }
            if (lower.StartsWith("_link") || lower.StartsWith("link<") || lower.StartsWith("linktid<") || lower.StartsWith("_linktid"))
            { pastelOle = ColHdrLink; row3Ole = ColHdrRow3Link; return; }
            var ttype = DpTypeNames.FromProtocolName(dt);
            switch (ttype)
            {
                case DpWireType.List:
                case DpWireType.Set: pastelOle = ColHdrList; row3Ole = ColHdrRow3List; return;
                case DpWireType.Map: pastelOle = ColHdrMap; row3Ole = ColHdrRow3Map; return;
                case DpWireType.Struct: pastelOle = ColHdrStruct; row3Ole = ColHdrRow3Struct; return;
                default: pastelOle = ColHdrPrimitive; row3Ole = ColHdrRow3Base; return;
            }
        }

        private static void ApplyHeaderStyles(IWritableExcelSheet sheet, List<FlatHeaderField> flatFields)
        {
            if (sheet == null || flatFields == null || flatFields.Count == 0) return;
            int colCount = flatFields.Count;
            sheet.SetRangeFont(1, 1, 1, colCount, FontGray1, true, false, 9);
            sheet.SetRangeFont(2, 2, 1, colCount, FontGray2, false, true, 9);
            sheet.SetRangeFont(3, 3, 1, colCount, FontWhite, true, false, 9);

            for (int c = 1; c <= colCount; c++)
            {
                var f = c - 1 < flatFields.Count ? flatFields[c - 1] : null;
                string dt = (f?.DataType ?? "").Trim();
                ClassifyColumnColor(dt, f, out int pastel, out int row3Bg);
                sheet.SetRangeInteriorColor(1, 1, c, c, pastel);
                sheet.SetRangeInteriorColor(2, 2, c, c, Lighten(pastel, 0.4f));
                bool hasParentStruct = !string.IsNullOrEmpty(f?.ParentStructName);
                sheet.SetRangeInteriorColor(3, 3, c, c, hasParentStruct ? ColHdrRow3Struct : row3Bg);
            }
            sheet.AutoFitColumns(1, colCount);
        }

        // ── 그룹 색상: 파랑톤(짝수 그룹) / 분홍톤(홀수 그룹), 그룹 내 행 교차 ──

        // 파랑톤 (Group A) — 밝은/어두운
        private static readonly int BlueLight  = ToOle(232, 240, 254);
        private static readonly int BlueDark   = ToOle(210, 224, 245);
        // 분홍톤 (Group B) — 밝은/어두운
        private static readonly int PinkLight  = ToOle(254, 236, 243);
        private static readonly int PinkDark   = ToOle(245, 218, 232);
        // 특수 컬럼 마커 (list/struct/map) — 파랑 계열
        private static readonly int ColDataListBlueL   = ToOle(225, 237, 255);
        private static readonly int ColDataListBlueD   = ToOle(205, 222, 248);
        private static readonly int ColDataStructBlueL = ToOle(228, 234, 255);
        private static readonly int ColDataStructBlueD = ToOle(212, 222, 252);
        private static readonly int ColDataMapBlueL    = ToOle(235, 228, 255);
        private static readonly int ColDataMapBlueD    = ToOle(222, 212, 252);
        // 특수 컬럼 마커 — 분홍 계열
        private static readonly int ColDataListPinkL   = ToOle(255, 232, 240);
        private static readonly int ColDataListPinkD   = ToOle(248, 212, 225);
        private static readonly int ColDataStructPinkL = ToOle(255, 228, 235);
        private static readonly int ColDataStructPinkD = ToOle(248, 212, 222);
        private static readonly int ColDataMapPinkL    = ToOle(248, 228, 245);
        private static readonly int ColDataMapPinkD    = ToOle(240, 212, 238);

        private static void ApplyDataStripes(IWritableExcelSheet sheet, int firstDataRow, int lastDataRow, int colCount, List<FlatHeaderField> flatFields = null)
        {
            if (sheet == null || colCount < 1 || lastDataRow < firstDataRow) return;

            int[] colCategory = null;
            if (flatFields != null && flatFields.Count >= colCount)
            {
                colCategory = new int[colCount + 1]; // 0=normal, 1=list/set, 2=struct, 3=map
                for (int c = 1; c <= colCount; c++)
                {
                    var f = flatFields[c - 1];
                    if (f.IsStructMarker) { colCategory[c] = 2; continue; }
                    var wt = DpTypeNames.FromProtocolName(f.DataType ?? "");
                    if (wt == DpWireType.List || wt == DpWireType.Set) colCategory[c] = 1;
                    else if (wt == DpWireType.Map) colCategory[c] = 3;
                    else colCategory[c] = 0;
                }
            }

            var groups = BuildMetaIdGroups(sheet, firstDataRow, lastDataRow);

            for (int gi = 0; gi < groups.Count; gi++)
            {
                var (gStart, gEnd) = groups[gi];
                bool blue = (gi % 2) == 0;

                for (int r = gStart; r <= gEnd; r++)
                {
                    bool light = ((r - gStart) % 2) == 0;
                    for (int c = 1; c <= colCount; c++)
                    {
                        int cat = (colCategory != null) ? colCategory[c] : 0;
                        int bg = PickGroupColor(blue, light, cat);
                        if ((c % 2) == 1) bg = Darken(bg, 0.04f);
                        try { sheet.SetRangeInteriorColor(r, r, c, c, bg); } catch { }
                    }
                }

                if (gi < groups.Count - 1)
                    try { sheet.SetBottomBorder(gEnd, 1, colCount, GrpBorderColor); } catch { }
            }
        }

        private static int PickGroupColor(bool blue, bool light, int cat)
        {
            if (cat == 1) return blue ? (light ? ColDataListBlueL : ColDataListBlueD) : (light ? ColDataListPinkL : ColDataListPinkD);
            if (cat == 2) return blue ? (light ? ColDataStructBlueL : ColDataStructBlueD) : (light ? ColDataStructPinkL : ColDataStructPinkD);
            if (cat == 3) return blue ? (light ? ColDataMapBlueL : ColDataMapBlueD) : (light ? ColDataMapPinkL : ColDataMapPinkD);
            return blue ? (light ? BlueLight : BlueDark) : (light ? PinkLight : PinkDark);
        }

        private static List<(int start, int end)> BuildMetaIdGroups(IExcelSheet sheet, int firstDataRow, int lastDataRow)
        {
            var groups = new List<(int start, int end)>();
            string currentId = null;
            int groupStart = firstDataRow;
            for (int r = firstDataRow; r <= lastDataRow; r++)
            {
                string id = sheet.CellValue(r, 1)?.Trim() ?? "";
                if (!string.Equals(id, currentId, StringComparison.Ordinal))
                {
                    if (currentId != null)
                        groups.Add((groupStart, r - 1));
                    currentId = id;
                    groupStart = r;
                }
            }
            if (currentId != null)
                groups.Add((groupStart, lastDataRow));
            if (groups.Count == 0)
                groups.Add((firstDataRow, lastDataRow));
            return groups;
        }

        // ── Container sheet: group-aware data stripes ─────────────────────────

        private static readonly int GrpBorderColor = ToOle(160, 170, 185);

        /// <summary>
        /// Apply group-aware coloring to a container (list/set/map) sheet:
        ///  - 짝수 그룹 = 파랑톤, 홀수 그룹 = 분홍톤 (그룹 내 행은 해당 톤의 밝은/어두운으로 교차)
        ///  - Bottom border at group boundaries
        /// </summary>
        public static void ApplyContainerDataStripes(IWritableExcelSheet sheet, int firstDataRow, int lastDataRow, int colCount)
        {
            if (sheet == null || colCount < 1 || lastDataRow < firstDataRow) return;

            var groups = BuildMetaIdGroups(sheet, firstDataRow, lastDataRow);

            for (int gi = 0; gi < groups.Count; gi++)
            {
                var (gStart, gEnd) = groups[gi];
                bool blue = (gi % 2) == 0;

                for (int r = gStart; r <= gEnd; r++)
                {
                    bool light = ((r - gStart) % 2) == 0;
                    int baseBg = blue ? (light ? BlueLight : BlueDark) : (light ? PinkLight : PinkDark);
                    for (int c = 1; c <= colCount; c++)
                    {
                        int bg = (c % 2) == 1 ? Darken(baseBg, 0.04f) : baseBg;
                        try { sheet.SetRangeInteriorColor(r, r, c, c, bg); } catch { }
                    }
                }

                if (gi < groups.Count - 1)
                    try { sheet.SetBottomBorder(gEnd, 1, colCount, GrpBorderColor); } catch { }
            }
        }

        /// <summary>
        /// Format enum columns to "value:name" and link columns to "value:name" or "value:NIA"/"0:MIA".
        /// Used after schema migration and when opening schema pane so numeric cells show resolved names.
        /// </summary>
        /// <param name="metaIdCol">1-based column index; when &gt; 0, only rows with non-empty value in this column are formatted (각 시트 첫 번째 칼럼 데이터 유무로 판단).</param>
        /// <param name="getEnumValuesForField">Returns "value:name" or "value:name:comment" list for the given schema field (caller resolves via loader/schema); null/empty if unknown.</param>
        /// <param name="getLinkNameForId">Optional. For link columns: (field, idString) => display name; null if not found. When provided, cells are written as "id:name" instead of "id:NIA".</param>
        public static void ApplyEnumAndLinkDisplayOnly(
            IExcelSheet sheet,
            IWritableExcelSheet writable,
            int firstDataRow,
            int lastDataRow,
            List<FlatHeaderField> flatFields,
            Dictionary<string, int> colByPath,
            Func<FlatHeaderField, List<string>> getEnumValuesForField,
            Func<FlatHeaderField, string, string> getLinkNameForId = null,
            int metaIdCol = 0)
        {
            if (flatFields == null || colByPath == null || sheet == null || writable == null) return;
            int effectiveLast = lastDataRow < firstDataRow ? firstDataRow : lastDataRow;

            foreach (var f in flatFields)
            {
                if (!colByPath.TryGetValue(f.HierarchyId, out int col) || col < 1) continue;
                string dt = (f.DataType ?? "").Trim();

                if (DpTypeNames.IsEnumDataType(dt))
                {
                    var values = getEnumValuesForField?.Invoke(f);
                    if (values == null) values = new List<string>();
                    for (int r = firstDataRow; r <= effectiveLast; r++)
                    {
                        try
                        {
                            if (metaIdCol > 0 && string.IsNullOrWhiteSpace(sheet.CellValue(r, metaIdCol)?.Trim()))
                                continue;
                            string str = sheet.CellValue(r, col)?.Trim() ?? "";
                            if (string.IsNullOrEmpty(str))
                            {
                                writable.SetColumnNumberFormat(col, "@");
                                writable.SetCellValue(r, col, "0:MIA");
                                continue;
                            }
                            if (str.IndexOf(':') >= 0) continue;
                            if (int.TryParse(str, out int num))
                            {
                                string line = null;
                                foreach (var v in values)
                                {
                                    var parts = v.Split(new[] { ':' }, 2);
                                    if (parts.Length > 0 && int.TryParse(parts[0].Trim(), out int vv) && vv == num)
                                    { line = v; break; }
                                }
                                writable.SetColumnNumberFormat(col, "@");
                                writable.SetCellValue(r, col, !string.IsNullOrEmpty(line) ? line : (num == 0 ? "0:MIA" : $"{num}:NIA"));
                            }
                        }
                        catch { }
                    }
                }
                else if (IsLinkDataType(dt))
                {
                    for (int r = firstDataRow; r <= effectiveLast; r++)
                    {
                        try
                        {
                            if (metaIdCol > 0 && string.IsNullOrWhiteSpace(sheet.CellValue(r, metaIdCol)?.Trim()))
                                continue;
                            string str = sheet.CellValue(r, col)?.Trim() ?? "";
                            if (string.IsNullOrEmpty(str))
                            {
                                writable.SetColumnNumberFormat(col, "@");
                                writable.SetCellValue(r, col, "0:MIA");
                                continue;
                            }
                            if (str.IndexOf(':') >= 0) continue;
                            if (long.TryParse(str, out long numL))
                            {
                                writable.SetColumnNumberFormat(col, "@");
                                string name = getLinkNameForId?.Invoke(f, str);
                                if (numL == 0)
                                    writable.SetCellValue(r, col, "0:MIA");
                                else if (!string.IsNullOrEmpty(name))
                                    writable.SetCellValue(r, col, $"{numL}:{name}");
                                else
                                    writable.SetCellValue(r, col, $"{numL}:NIA");
                            }
                        }
                        catch { }
                    }
                }
            }
        }

        /// <summary>True if the data type string denotes a link (meta_id or tid) column.</summary>
        public static bool IsLinkDataType(string dt)
        {
            if (string.IsNullOrEmpty(dt)) return false;
            return dt.StartsWith("_link_", StringComparison.OrdinalIgnoreCase)
                || dt.StartsWith("_linktid_", StringComparison.OrdinalIgnoreCase)
                || dt.StartsWith("link<", StringComparison.OrdinalIgnoreCase)
                || dt.StartsWith("lnk<", StringComparison.OrdinalIgnoreCase)
                || dt.StartsWith("linktid<", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Walks the schema by HierarchyId path (e.g. "30.2.1") and returns the field descriptor.
        /// Caller supplies getOrderedFields(schema) and getSchemaByTypeName(typeName) so the protocol stays agnostic of loader/reflection source.
        /// </summary>
        public static object GetFieldDescriptorByHierarchyId(
            object schema,
            string hierarchyId,
            Func<object, IEnumerable<KeyValuePair<string, object>>> getOrderedFields,
            Func<string, object> getSchemaByTypeName)
        {
            if (schema == null || string.IsNullOrEmpty(hierarchyId) || getOrderedFields == null || getSchemaByTypeName == null) return null;
            var parts = hierarchyId.Split('.');
            object currentSchema = schema;
            for (int i = 0; i < parts.Length; i++)
            {
                var fields = getOrderedFields(currentSchema);
                if (fields == null) return null;
                var pair = fields.FirstOrDefault(kv => string.Equals(kv.Key?.ToString(), parts[i].Trim(), StringComparison.Ordinal));
                if (pair.Value == null) return null;
                if (i == parts.Length - 1) return pair.Value;
                string typeName = GetTypeNameFromFieldDescriptor(pair.Value);
                if (string.IsNullOrEmpty(typeName)) return null;
                string typeKind = GetFieldTypeString(pair.Value);
                if (typeKind == "list" || typeKind == "set" || typeKind == "map")
                    typeName = DpTypeNames.StripOuterGeneric(typeName);
                currentSchema = getSchemaByTypeName(typeName);
                if (currentSchema == null) return null;
            }
            return null;
        }

        /// <summary>득팩 필드 디스크립터에서 타입 이름을 가져옴. typedef인 경우 typedef 이름이 반환됨.</summary>
        public static string GetFieldTypeName(object fieldDescriptor)
        {
            if (fieldDescriptor == null) return null;
            try
            {
                var prop = fieldDescriptor.GetType().GetProperty("TypeName");
                return prop?.GetValue(fieldDescriptor)?.ToString()?.Trim();
            }
            catch { return null; }
        }

        /// <summary>득팩 필드 디스크립터가 typedef 타입인지 여부. Type이 primitive이고 TypeName이 있으면 typedef로 간주.</summary>
        public static bool IsTypedefField(object fieldDescriptor)
        {
            if (fieldDescriptor == null) return false;
            string typeName = GetFieldTypeName(fieldDescriptor);
            if (string.IsNullOrWhiteSpace(typeName)) return false;
            string typeStr = GetFieldTypeString(fieldDescriptor);
            if (string.IsNullOrEmpty(typeStr)) return false;
            switch (typeStr)
            {
                case "bool": case "byte": case "int16": case "int32": case "int64": case "double": case "string":
                    return typeName.IndexOf('<') < 0;
                default: return false;
            }
        }

        private static string GetTypeNameFromFieldDescriptor(object fieldDescriptor) => GetFieldTypeName(fieldDescriptor);

        private static string GetFieldTypeString(object fieldDescriptor)
        {
            if (fieldDescriptor == null) return null;
            try
            {
                var prop = fieldDescriptor.GetType().GetProperty("Type");
                var val = prop?.GetValue(fieldDescriptor);
                if (val is DpSchemaType st) return DpTypeNames.SchemaTypeToStandardString(st);
                return val?.ToString()?.Trim();
            }
            catch { return null; }
        }

        /// <summary>
        /// Build path → column index map from sheet row 1 (HIERARCHY_ID). All Excel-style header column resolution goes through the protocol.
        /// </summary>
        public static Dictionary<string, int> BuildColByPath(IExcelSheet sheet)
        {
            var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            if (sheet == null) return map;
            for (int col = 1; col <= sheet.LastColumn; col++)
            {
                string path = sheet.CellValue(HIERARCHY_ID_ROW, col)?.Trim();
                if (!string.IsNullOrEmpty(path) && !map.ContainsKey(path))
                    map[path] = col;
            }
            return map;
        }

        /// <summary>
        /// Get ordered (key, fieldDescriptor) list from a schema object via reflection. Single source for Excel/schema field enumeration.
        /// </summary>
        public static List<KeyValuePair<string, object>> GetOrderedSchemaFields(object schema)
        {
            if (schema == null) return new List<KeyValuePair<string, object>>();
            try
            {
                var fieldsProp = schema.GetType().GetProperty("Fields");
                if (fieldsProp == null) return new List<KeyValuePair<string, object>>();
                var fieldsVal = fieldsProp.GetValue(schema);
                if (fieldsVal == null || !(fieldsVal is IEnumerable en)) return new List<KeyValuePair<string, object>>();
                var list = new List<KeyValuePair<string, object>>();
                foreach (var item in en)
                {
                    if (item == null) continue;
                    var kvType = item.GetType();
                    string key = kvType.GetProperty("Key")?.GetValue(item)?.ToString() ?? "";
                    object val = kvType.GetProperty("Value")?.GetValue(item);
                    list.Add(new KeyValuePair<string, object>(key, val));
                }
                return list.OrderBy(kv =>
                {
                    try
                    {
                        if (kv.Value == null) return 0;
                        var orderProp = kv.Value.GetType().GetProperty("Order");
                        if (orderProp != null)
                            return Convert.ToInt32(orderProp.GetValue(kv.Value));
                    }
                    catch { }
                    return int.TryParse(kv.Key, out int id) ? id : 0;
                }).ToList();
            }
            catch { return new List<KeyValuePair<string, object>>(); }
        }

        /// <summary>
        /// Convert schema object (from DLL/reflection) to DpSchema. All Excel-style schema object handling in the protocol.
        /// </summary>
        public static DpSchema BuildDpSchemaFromObject(object schema)
        {
            if (schema == null) return null;
#pragma warning disable CS0618
            if (schema is ThriftSchema ts) return ts.ToDpSchema();
#pragma warning restore CS0618
            if (schema is DpSchema ds) return ds;
            try
            {
                var schemaType = schema.GetType();
                var result = new DpSchema();
                result.Name = ReflectString(schemaType, schema, "Name") ?? "";
                result.Fields = new Dictionary<int, DpFieldSchema>();
                var fields = GetOrderedSchemaFields(schema);
                foreach (var kv in fields)
                {
                    if (!int.TryParse(kv.Key, out int id)) continue;
                    object f = kv.Value;
                    if (f == null) continue;
                    var ft = f.GetType();
                    var fs = new DpFieldSchema
                    {
                        Id = id,
                        Name = ReflectString(ft, f, "Name") ?? "",
                        TypeName = ReflectString(ft, f, "TypeName") ?? "",
                        DocComment = ReflectString(ft, f, "DocComment") ?? ""
                    };
                    var orderProp = ft.GetProperty("Order");
                    fs.Order = orderProp != null ? Convert.ToInt32(orderProp.GetValue(f)) : id;
                    string typeStr = "String";
                    try
                    {
                        var typeProp = ft.GetProperty("Type");
                        if (typeProp != null) typeStr = typeProp.GetValue(f)?.ToString() ?? "String";
                    }
                    catch { }
                    switch (typeStr)
                    {
                        case "bool": fs.Type = DpSchemaType.Bool; break;
                        case "byte": fs.Type = DpSchemaType.Byte; break;
                        case "int16": fs.Type = DpSchemaType.Int16; break;
                        case "int32": fs.Type = DpSchemaType.Int32; break;
                        case "int64": fs.Type = DpSchemaType.Int64; break;
                        case "double": fs.Type = DpSchemaType.Double; break;
                        case "struct": fs.Type = DpSchemaType.Struct; break;
                        case "list": fs.Type = DpSchemaType.List; break;
                        case "set": fs.Type = DpSchemaType.Set; break;
                        case "map": fs.Type = DpSchemaType.Map; break;
                        case "enum": fs.Type = DpSchemaType.Enum; break;
                        default: fs.Type = DpSchemaType.String; break;
                    }
                    result.Fields[id] = fs;
                }
                return result;
            }
            catch { return null; }
        }

        /// <summary>Compatibility: use BuildDpSchemaFromObject.</summary>
        public static DpSchema BuildThriftSchemaFromObject(object schema) => BuildDpSchemaFromObject(schema);

        /// <summary>
        /// Field descriptor → Excel DATATYPE string (e.g. "enum&lt;X&gt;", "i64"). Protocol owns all Excel-style type string derivation.
        /// </summary>
        public static string GetDataTypeFromFieldDescriptor(object fieldDescriptor)
        {
            if (fieldDescriptor == null) return "string";
            try
            {
                var ft = fieldDescriptor.GetType();
                var fs = new DpFieldSchema
                {
                    Name = ReflectString(ft, fieldDescriptor, "Name") ?? "",
                    TypeName = ReflectString(ft, fieldDescriptor, "TypeName") ?? ""
                };
                string typeStr = "String";
                var typeProp = ft.GetProperty("Type");
                if (typeProp != null) typeStr = typeProp.GetValue(fieldDescriptor)?.ToString() ?? "String";
                switch (typeStr)
                {
                    case "bool": fs.Type = DpSchemaType.Bool; break;
                    case "byte": fs.Type = DpSchemaType.Byte; break;
                    case "int16": fs.Type = DpSchemaType.Int16; break;
                    case "int32": fs.Type = DpSchemaType.Int32; break;
                    case "int64": fs.Type = DpSchemaType.Int64; break;
                    case "double": fs.Type = DpSchemaType.Double; break;
                    case "struct": fs.Type = DpSchemaType.Struct; break;
                    case "list": fs.Type = DpSchemaType.List; break;
                    case "set": fs.Type = DpSchemaType.Set; break;
                    case "map": fs.Type = DpSchemaType.Map; break;
                    case "enum": fs.Type = DpSchemaType.Enum; break;
                    default: fs.Type = DpSchemaType.String; break;
                }
                return DpTypeNames.SchemaFieldToDataType(fs);
            }
            catch { return "string"; }
        }

        /// <summary>Read a string property from an object via reflection. Used for schema/field descriptor access.</summary>
        public static string ReflectString(Type t, object obj, string propName)
        {
            if (t == null || obj == null) return null;
            try
            {
                var prop = t.GetProperty(propName);
                return prop?.GetValue(obj)?.ToString();
            }
            catch { return null; }
        }

        #endregion

        private int WriteFieldPathToCol(string fieldPath)
        {
            if (_fieldIdToCol.TryGetValue(fieldPath, out int col))
                return col;
            return -1;
        }

        private void TrackWriteRow(int row)
        {
            if (row > _maxWriteRow) _maxWriteRow = row;
        }

        public void WriteStructBegin(DpRecord s)
        {
            if (_writeSheet == null) return;

            if (_writeListStack.Count > 0)
            {
                var ls = _writeListStack.Peek();
                if (ls.StructDepth == 0)
                {
                    if (ls.SeparatedSheet != null)
                    {
                        int r = ls.StartRow + ls.CurrentElement;
                        ls.SeparatedSheet.SetCellValue(r, 1, ls.SeparatedMetaId ?? "");
                        ls.SeparatedSheet.SetCellValue(r, 2, ls.SeparatedMetaName);
                        _writeRow = r;
                        TrackWriteRow(r);
                    }
                    else
                    {
                        _writeRow = ls.StartRow + ls.CurrentElement;
                        TrackWriteRow(_writeRow);
                    }
                    ls.CurrentElement++;
                    _writePathStack.Push(_writeCurrentPath);
                    _writeCurrentPath = ls.ListPath;
                }
                ls.StructDepth++;
            }
            // Non-list struct path is already set by WriteFieldBegin (DpWireType.Struct case)
        }

        public void WriteStructEnd()
        {
            if (_writeSheet == null) return;

            if (_writeListStack.Count > 0)
            {
                var ls = _writeListStack.Peek();
                ls.StructDepth--;
                if (ls.StructDepth == 0)
                {
                    // Pop the path that WriteStructBegin pushed for this list element
                    if (_writePathStack.Count > 0)
                        _writeCurrentPath = _writePathStack.Pop();
                }
            }
            else
            {
                // Normal struct: WriteFieldBegin pushed the path, pop it here
                if (_writePathStack.Count > 0)
                    _writeCurrentPath = _writePathStack.Pop();
            }
        }

        public void WriteFieldBegin(DpColumn f)
        {
            if (_writeSheet == null) return;
            _writeCurrentField = f;

            if (f.Type == DpWireType.Struct)
            {
                string fieldPath = string.IsNullOrEmpty(_writeCurrentPath)
                    ? f.ID.ToString()
                    : _writeCurrentPath + "." + f.ID;
                _writePathStack.Push(_writeCurrentPath);
                _writeCurrentPath = fieldPath;
            }
        }

        public void WriteFieldEnd()
        {
            if (_writeSheet == null) return;
        }

        public void WriteFieldStop()
        {
            if (_writeSheet == null) return;
        }

        private void WriteCellForCurrentField(string value)
        {
            if (_writeSheet == null) return;

            // Primitive inside a primitive list
            if (_writeListStack.Count > 0)
            {
                var ls = _writeListStack.Peek();
                if (ls.IsPrimitiveList && ls.StructDepth == 0)
                {
                    if (ls.SeparatedSheet != null)
                    {
                        int r = ls.StartRow + ls.CurrentElement;
                        ls.SeparatedSheet.SetCellValue(r, 1, ls.SeparatedMetaId ?? "");
                        ls.SeparatedSheet.SetCellValue(r, 2, ls.SeparatedMetaName);
                        ls.SeparatedSheet.SetCellValue(r, 3, value);
                        ls.CurrentElement++;
                        return;
                    }
                    else
                    {
                        _writeRow = ls.StartRow + ls.CurrentElement;
                        TrackWriteRow(_writeRow);
                        ls.CurrentElement++;

                        if (ls.PrimitiveElemCol > 0)
                        {
                            _writeSheet.SetCellValue(_writeRow, ls.PrimitiveElemCol, value);
                            return;
                        }
                    }
                }
                else if (ls.SeparatedSheet != null && ls.StructDepth > 0)
                {
                    // Full path for the field in the separated sheet (headers use full path)
                    string fullPath = string.IsNullOrEmpty(_writeCurrentPath)
                        ? _writeCurrentField.ID.ToString()
                        : _writeCurrentPath + "." + _writeCurrentField.ID;

                    // Reuse cached separated protocol, or create one
                    if (_cachedSepProto == null || _cachedSepSheet != ls.SeparatedSheet)
                    {
                        _cachedSepSheet = ls.SeparatedSheet;
                        // 쓰기 시 분리 시트는 항상 v2(3행 헤더)
                        _cachedSepProto = new DpExcelProtocol(ls.SeparatedSheet, FIRST_DATA_ROW, null, "meta", ls.SeparatedSheet?.SheetName ?? "");
                    }
                    int sepCol = _cachedSepProto.WriteFieldPathToCol(fullPath);
                    if (sepCol > 0)
                    {
                        ls.SeparatedSheet.SetCellValue(_writeRow, sepCol, value);
                        return;
                    }
                }
            }

            string fieldPath = string.IsNullOrEmpty(_writeCurrentPath)
                ? _writeCurrentField.ID.ToString()
                : _writeCurrentPath + "." + _writeCurrentField.ID;

            int col = WriteFieldPathToCol(fieldPath);
            if (col > 0)
            {
                _writeSheet.SetCellValue(_writeRow, col, value);
                TrackWriteRow(_writeRow);
            }
        }

        public void WriteBool(bool b)
        {
            WriteCellForCurrentField(b ? "1" : "0");
        }

        public void WriteByte(byte b)
        {
            WriteCellForCurrentField(b.ToString());
        }

        public void WriteI16(short i16)
        {
            WriteCellForCurrentField(i16.ToString());
        }

        public void WriteI32(int i32)
        {
            string fieldPath = string.IsNullOrEmpty(_writeCurrentPath)
                ? _writeCurrentField.ID.ToString()
                : _writeCurrentPath + "." + _writeCurrentField.ID;
            string value = ResolveEnumDisplayValue(fieldPath, i32);
            WriteCellForCurrentField(value ?? i32.ToString());
        }

        /// <summary>
        /// Uses schema _colDataType to decide if field is enum; only then resolves "value:name" via delegates. For paths not in map (e.g. list element), falls back to delegates to detect enum.
        /// </summary>
        private string ResolveEnumDisplayValue(string fieldPath, int i32)
        {
            object? fd = GetFieldDescriptor?.Invoke(fieldPath);
            bool isEnum = _fieldIdToCol.TryGetValue(fieldPath, out int col)
                && _colDataType.TryGetValue(col, out var dt)
                && DpTypeNames.IsEnumDataType(dt ?? "");
            if (!isEnum && fd != null && GetEnumValuesForField != null && GetEnumValuesForField(fd) != null)
                isEnum = true;
            if (!isEnum || fd == null || GetEnumValuesForField == null) return null;
            var list = GetEnumValuesForField(fd);
            if (list == null || list.Count == 0) return null;
            foreach (var line in list)
            {
                var parts = line.Split(new[] { ':' }, 2);
                if (parts.Length >= 1 && int.TryParse(parts[0].Trim(), out int v) && v == i32)
                    return line;
            }
            return i32 == 0 ? "0:MIA" : $"{i32}:NIA";
        }

        public void WriteI64(long i64)
        {
            WriteCellForCurrentField(i64.ToString());
        }

        public void WriteDouble(double d)
        {
            WriteCellForCurrentField(d.ToString(System.Globalization.CultureInfo.InvariantCulture));
        }

        public void WriteString(string? s)
        {
            WriteCellForCurrentField(s ?? "");
        }

        public void WriteBinary(byte[]? b)
        {
            WriteCellForCurrentField(b != null ? Convert.ToBase64String(b) : "");
        }

        public void WriteListBegin(DpList list)
        {
            if (_writeSheet == null) return;

            string fieldPath = string.IsNullOrEmpty(_writeCurrentPath)
                ? _writeCurrentField.ID.ToString()
                : _writeCurrentPath + "." + _writeCurrentField.ID;

            // ── Separated sheet mode (정책에서 kind·시트 이름 사용) ─────────────────────
            if (_resolver != null)
            {
                string fieldName = "";
                if (_fieldIdToCol.TryGetValue(fieldPath, out int rootCol2) && _colColumnName.ContainsKey(rootCol2))
                    fieldName = _colColumnName[rootCol2];

                string kind = ContainerSheetPolicy.GetKindForWireType(DpWireType.List);
                string sheetName = ContainerSheetNaming.FormatContainerSheetName(fieldPath, kind, fieldName);

                string[]? hdrIds = null, hdrTypes = null, hdrNames = null, hdrStructNames = null;
                bool[] hdrIsMarker = null;
                BuildContainerSheetHeaders(fieldPath, list.ElementType, out hdrIds, out hdrTypes, out hdrNames, out hdrStructNames, out hdrIsMarker);

                var sepWriteSheet = _resolver.GetOrCreateSheet(
                    sheetName,
                    headerHierarchyIds: hdrIds,
                    headerDataTypes:    hdrTypes,
                    headerColumnNames:  hdrNames,
                    headerStructNames:  _useCompactHeader ? hdrStructNames : null);

                if (sepWriteSheet != null)
                {
                    // Next append row: use tracked last row per sheet so multiple records append correctly (UsedRange/LastRow can be stale after NumberFormat or COM).
                    int appendRow = _containerSheetLastRow.TryGetValue(sheetName, out int lastRow) ? lastRow + 1 : FIRST_DATA_ROW;

                    // Get tuid/name from the write sheet (already written by preceding fields)
                    string metaId   = _writeSheet.CellValue(_writeRow, 1) ?? "";
                    string metaName = _writeSheet.CellValue(_writeRow, 2) ?? "";

                    // Write list root column on main sheet: "[N >]" 표시 (마우스 클릭 시 리스트 탭으로 이동)
                    int rootColMain = WriteFieldPathToCol(fieldPath);
                    if (rootColMain > 0)
                        _writeSheet.SetCellValue(_writeRow, rootColMain, "[" + list.Count + " >]");

                    bool isPrimitive = (list.ElementType != DpWireType.Struct
                                     && list.ElementType != DpWireType.List
                                     && list.ElementType != DpWireType.Map
                                     && list.ElementType != DpWireType.Set);
                    int primitiveElemCol = isPrimitive ? 3 : -1; // col 3 = first element col (after tuid, name)

                    var state = new WriteListState
                    {
                        StartRow = appendRow,
                        CurrentElement = 0,
                        ListPath = fieldPath,
                        StructDepth = 0,
                        IsPrimitiveList = isPrimitive,
                        PrimitiveElemCol = primitiveElemCol,
                        SeparatedSheet = sepWriteSheet,
                        SeparatedSheetName = sheetName,
                        SeparatedMetaId = metaId,
                        SeparatedMetaName = metaName,
                        MainSheetRow = _writeRow,
                        MainSheetMaxRow = _maxWriteRow
                    };
                    _maxWriteRow = appendRow - 1;
                    _writeListStack.Push(state);
                    _writePathStack.Push(_writeCurrentPath);
                    _writeCurrentPath = fieldPath;
                    return;
                }
            }

            // ── Embedded (original) mode ──────────────────────────────────────
            bool isPrimitive2 = (list.ElementType != DpWireType.Struct
                             && list.ElementType != DpWireType.List
                             && list.ElementType != DpWireType.Map
                             && list.ElementType != DpWireType.Set);
            int primitiveElemCol2 = -1;
            if (isPrimitive2)
            {
                string prefix = fieldPath + ".";
                foreach (var kvp in _fieldIdToCol)
                {
                    if (kvp.Key.StartsWith(prefix))
                    {
                        primitiveElemCol2 = kvp.Value;
                        break;
                    }
                }
            }

            // Write list root column: record count
            int rootCol = WriteFieldPathToCol(fieldPath);
            if (rootCol > 0 && list.Count > 0)
                _writeSheet.SetCellValue(_writeRow, rootCol, list.Count.ToString());

            var embState = new WriteListState
            {
                StartRow = _writeRow,
                CurrentElement = 0,
                ListPath = fieldPath,
                StructDepth = 0,
                IsPrimitiveList = isPrimitive2,
                PrimitiveElemCol = primitiveElemCol2
            };
            _writeListStack.Push(embState);

            _writePathStack.Push(_writeCurrentPath);
            _writeCurrentPath = fieldPath;
        }

        public void WriteListEnd()
        {
            if (_writeSheet == null) return;

            if (_writeListStack.Count > 0)
            {
                var state = _writeListStack.Pop();
                if (state.SeparatedSheet != null)
                {
                    if (state.CurrentElement > 0)
                    {
                        int lastRow = state.StartRow + state.CurrentElement - 1;
                        _containerSheetsWritten.Add((state.SeparatedSheetName, state.StartRow, lastRow, state.SeparatedSheet.LastColumn));
                        _containerSheetLastRow[state.SeparatedSheetName] = lastRow;
                    }
                    _writeRow = state.MainSheetRow;
                    _maxWriteRow = state.MainSheetMaxRow;
                }
                else
                {
                    // Embedded: advance _writeRow past rows consumed by this list
                    int lastListRow = state.StartRow + state.CurrentElement - 1;
                    if (lastListRow > _maxWriteRow) _maxWriteRow = lastListRow;
                    _writeRow = lastListRow > state.StartRow ? lastListRow : state.StartRow;
                }
            }
            if (_writePathStack.Count > 0)
                _writeCurrentPath = _writePathStack.Pop();
        }

        public void WriteSetBegin(DpSet set)
        {
            WriteListBegin(new DpList { ElementType = set.ElementType, Count = set.Count });
        }

        public void WriteSetEnd() { WriteListEnd(); }

        public void WriteMapBegin(DpDict map)
        {
            if (_writeSheet == null) return;
        }

        public void WriteMapEnd()
        {
            if (_writeSheet == null) return;
        }

        /// <summary>
        /// Walk _writeSchema (and nested schemas via ResolveTypeName) to find the element TypeName
        /// for a list/set field at the given fieldPath (e.g. "30" → spawners → "List&lt;Spawner&gt;" → "Spawner").
        /// Returns null if schema is not available or field not found.
        /// </summary>
        private string ResolveElementTypeNameFromSchema(string fieldPath)
        {
            if (_writeSchema == null || _writeSchema.Fields == null || string.IsNullOrEmpty(fieldPath))
                return null;

            string[] parts = fieldPath.Split('.');
            DpSchema current = _writeSchema;

            for (int i = 0; i < parts.Length; i++)
            {
                if (current?.Fields == null) return null;
                if (!int.TryParse(parts[i], out int fid)) return null;
                if (!current.Fields.TryGetValue(fid, out var field)) return null;

                if (i == parts.Length - 1)
                {
                    // This is the target list/set field - strip outer generic to get element type
                    return DpTypeNames.StripOuterGeneric(field.TypeName ?? "");
                }

                // Intermediate field: must be struct or list<struct> - resolve to descend
                string innerType = field.Type == DpSchemaType.Struct
                    ? field.TypeName
                    : DpTypeNames.StripOuterGeneric(field.TypeName ?? "");
                if (string.IsNullOrEmpty(innerType) || ResolveTypeName == null) return null;
                current = ResolveTypeName(innerType);
            }
            return null;
        }

        #region Excel header arrays (shared main / container)

        /// <summary>Container 시트 상단 2열 고정 (meta_id=[&lt; meta_id] 표현, name). nav 제거.</summary>
        private static void GetContainerFixedHeaderArrays(
            out string[] hierIds, out string[] dataTypes, out string[] colNames, out string[] structNames, out bool[] isMarker)
        {
            hierIds     = new[] { ContainerSheetNaming.META_ID_COLUMN, ContainerSheetNaming.META_NAME_COLUMN };
            dataTypes   = new[] { DpTypeNames.ToProtocolName(DpWireType.Int64), DpTypeNames.ToProtocolName(DpWireType.String) };
            colNames    = new[] { "meta_id", "name" };
            structNames = new[] { "", "" };
            isMarker    = new[] { false, false };
        }

        /// <summary>리스트 시트 meta_id 셀 값 "[&lt; id]"에서 id 추출. 매칭/이동 시 사용.</summary>
        public static string ParseMetaIdFromListCell(string cellValue)
        {
            if (string.IsNullOrEmpty(cellValue)) return cellValue;
            var s = cellValue.Trim();
            if (s.StartsWith("[< ", StringComparison.Ordinal) && s.EndsWith("]", StringComparison.Ordinal) && s.Length > 4)
                return s.Substring(3, s.Length - 4).Trim();
            return s;
        }

        /// <summary>FlatHeaderField 리스트 → 헤더 배열로 변환. pathPrefix 있으면 HierarchyId 앞에 붙임 (리스트 요소 열용).</summary>
        private static void FlatFieldsToHeaderArrays(IReadOnlyList<FlatHeaderField> fields, string pathPrefix,
            out string[] hierIds, out string[] dataTypes, out string[] colNames, out string[] structNames, out bool[] isMarker)
        {
            int n = fields?.Count ?? 0;
            hierIds     = new string[n];
            dataTypes   = new string[n];
            colNames    = new string[n];
            structNames = new string[n];
            isMarker    = new bool[n];
            string prefix = pathPrefix ?? "";
            for (int i = 0; i < n; i++)
            {
                var f = fields[i];
                hierIds[i]     = string.IsNullOrEmpty(prefix) ? f.HierarchyId : (prefix + f.HierarchyId);
                dataTypes[i]   = f.DataType ?? "";
                colNames[i]    = (string.IsNullOrEmpty(f.ColumnName) && f.IsStructMarker ? (f.ParentStructName ?? f.HierarchyId) : f.ColumnName) ?? "";
                structNames[i] = f.ParentStructName ?? "";
                isMarker[i]    = f.IsStructMarker;
            }
        }

        /// <summary>헤더 배열 5개 → List&lt;FlatHeaderField&gt;. 스타일 적용용. null 배열은 길이 0으로 취급.</summary>
        private static List<FlatHeaderField> HeaderArraysToFlatFields(
            string[] hierIds, string[] dataTypes, string[] colNames, string[] structNames, bool[] isMarker)
        {
            int n = hierIds?.Length ?? 0;
            var list = new List<FlatHeaderField>(n);
            for (int i = 0; i < n; i++)
            {
                list.Add(new FlatHeaderField
                {
                    HierarchyId    = i < hierIds.Length ? hierIds[i] : "",
                    DataType      = dataTypes != null && i < dataTypes.Length ? dataTypes[i] : "",
                    ColumnName    = colNames != null && i < colNames.Length ? colNames[i] : "",
                    ParentStructName = structNames != null && i < structNames.Length ? structNames[i] : "",
                    IsStructMarker = isMarker != null && i < isMarker.Length && isMarker[i]
                });
            }
            return list;
        }

        #endregion

        /// <summary>
        /// Build header arrays (meta_id, name, element columns) for a container sheet.
        /// Same rule as main sheet: include all FlattenSchema output (do not filter struct markers)
        /// so schema/read mapping stays valid. Uses ResolveTypeName to look up element schema.
        /// Returns null arrays if element schema is not resolvable (primitive list gets fixed headers).
        /// </summary>
        private void BuildContainerSheetHeaders(string fieldPath, DpWireType elementType,
            out string[] hierIds, out string[] dataTypes, out string[] colNames, out string[] structNames, out bool[] isMarker)
        {
            hierIds = null; dataTypes = null; colNames = null; structNames = null; isMarker = null;

            bool isPrimitive = (elementType != DpWireType.Struct && elementType != DpWireType.List
                             && elementType != DpWireType.Map && elementType != DpWireType.Set);
            if (isPrimitive)
            {
                GetContainerFixedHeaderArrays(out string[] fixHier, out string[] fixTypes, out string[] fixCols, out string[] fixStruct, out bool[] fixMark);
                hierIds     = new string[3];
                dataTypes   = new string[3];
                colNames    = new string[3];
                structNames = new string[3];
                isMarker    = new bool[3];
                Array.Copy(fixHier, hierIds, 2);
                Array.Copy(fixTypes, dataTypes, 2);
                Array.Copy(fixCols, colNames, 2);
                Array.Copy(fixStruct, structNames, 2);
                Array.Copy(fixMark, isMarker, 2);
                hierIds[2] = "value";
                dataTypes[2] = DpTypeNames.ToProtocolName(elementType);
                colNames[2] = "value";
                structNames[2] = "";
                isMarker[2] = false;
                return;
            }

            if (elementType == DpWireType.Struct && ResolveTypeName != null)
            {
                string typeName = ResolveElementTypeNameFromSchema(fieldPath);
                if (string.IsNullOrEmpty(typeName))
                {
                    if (_fieldIdToCol.TryGetValue(fieldPath, out int rootCol) && _colDataType.ContainsKey(rootCol))
                    {
                        string dt = _colDataType[rootCol];
                        typeName = DpTypeNames.StripOuterGeneric(dt);
                    }
                }
                if (string.IsNullOrEmpty(typeName)) return;

                var elemSchema = ResolveTypeName(typeName);
                if (elemSchema == null) return;

                // Same as main sheet: full FlattenSchema (no filtering of struct markers).
                var elemFields = FlattenSchema(elemSchema, ResolveTypeName, "");
                GetContainerFixedHeaderArrays(out string[] fixHier, out string[] fixTypes, out string[] fixCols, out string[] fixStruct, out bool[] fixMark);
                FlatFieldsToHeaderArrays(elemFields, fieldPath + ".", out string[] elemHier, out string[] elemTypes, out string[] elemCols, out string[] elemStruct, out bool[] elemMark);

                int total = fixHier.Length + elemHier.Length;
                hierIds     = new string[total];
                dataTypes   = new string[total];
                colNames    = new string[total];
                structNames = new string[total];
                isMarker    = new bool[total];
                Array.Copy(fixHier, hierIds, fixHier.Length);
                Array.Copy(fixTypes, dataTypes, fixTypes.Length);
                Array.Copy(fixCols, colNames, fixCols.Length);
                Array.Copy(fixStruct, structNames, fixStruct.Length);
                Array.Copy(fixMark, isMarker, fixMark.Length);
                Array.Copy(elemHier, 0, hierIds, fixHier.Length, elemHier.Length);
                Array.Copy(elemTypes, 0, dataTypes, fixTypes.Length, elemTypes.Length);
                Array.Copy(elemCols, 0, colNames, fixCols.Length, elemCols.Length);
                Array.Copy(elemStruct, 0, structNames, fixStruct.Length, elemStruct.Length);
                Array.Copy(elemMark, 0, isMarker, fixMark.Length, elemMark.Length);
            }
        }

        #endregion

        #region Schema → Flat Header

        /// <summary>
        /// 각 FlatHeaderField의 ColumnName을 getDisplayNameForHierarchyId(HierarchyId) 결과로 덮어씀.
        /// Excel에서 읽은 헤더는 리스트 내부 등에서 부모명이 들어올 수 있으므로, 스키마 필드명으로 보정할 때 사용.
        /// </summary>
        public static void ApplyDisplayNames(List<FlatHeaderField> fields, Func<string, string> getDisplayNameForHierarchyId)
        {
            if (fields == null || getDisplayNameForHierarchyId == null) return;
            foreach (var f in fields)
            {
                if (string.IsNullOrEmpty(f?.HierarchyId)) continue;
                string name = getDisplayNameForHierarchyId(f.HierarchyId);
                if (!string.IsNullOrEmpty(name))
                    f.ColumnName = name;
            }
        }

        /// <summary>
        /// Reorder flat fields so tuid, tid, name (by ColumnName) come first, then the rest.
        /// Used for meta_data main sheet column fix.
        /// </summary>
        public static List<FlatHeaderField> ReorderFlatWithMetaIdTidMetaNameFirst(List<FlatHeaderField> flat)
        {
            return ReorderFlatWithMetaIdTidMetaNameFirst(flat, null, null);
        }

        /// <summary>
        /// Reorder flat fields by key→name→note. category와 getKeyFieldNames가 있으면 해당 카테고리 고정 열 순서 사용(keyed면 meta_id 제외).
        /// </summary>
        public static List<FlatHeaderField> ReorderFlatWithMetaIdTidMetaNameFirst(List<FlatHeaderField> flat, string category, Func<string, IReadOnlyList<string>> getKeyFieldNames)
        {
            if (flat == null || flat.Count == 0) return flat;
            var fixedNames = (category != null && getKeyFieldNames != null)
                ? GetMainSheetFixedColumnNamesForCategory(category, getKeyFieldNames)
                : MainSheetFixedColumnNames;
            var reordered = new List<FlatHeaderField>(flat.Count);
            foreach (string name in fixedNames)
            {
                for (int i = 0; i < flat.Count; i++)
                {
                    string cn = flat[i].ColumnName ?? "";
                    if (string.Equals(cn, name, StringComparison.OrdinalIgnoreCase) ||
                        (name == "tuid" && string.Equals(cn, "meta_id", StringComparison.OrdinalIgnoreCase)) ||
                        (name == "name" && string.Equals(cn, "meta_name", StringComparison.OrdinalIgnoreCase)) ||
                        (name == "note" && string.Equals(cn, "meta_note", StringComparison.OrdinalIgnoreCase)))
                    {
                        reordered.Add(flat[i]);
                        break;
                    }
                }
            }
            for (int i = 0; i < flat.Count; i++)
            {
                string cn = flat[i].ColumnName ?? "";
                bool isFixed = false;
                foreach (string name in fixedNames)
                {
                    if (string.Equals(cn, name, StringComparison.OrdinalIgnoreCase) ||
                        (name == "tuid" && string.Equals(cn, "meta_id", StringComparison.OrdinalIgnoreCase)) ||
                        (name == "name" && string.Equals(cn, "meta_name", StringComparison.OrdinalIgnoreCase)) ||
                        (name == "note" && string.Equals(cn, "meta_note", StringComparison.OrdinalIgnoreCase)))
                    { isFixed = true; break; }
                }
                if (!isFixed) reordered.Add(flat[i]);
            }
            return reordered;
        }

        /// <summary>Excel 스키마 정보용 DataType. typedef이고 TypeName에 _link 포함인 경우만 typedef 이름 사용.</summary>
        private static string GetExcelDataTypeForField(DpFieldSchema f)
        {
            if (f == null) return "string";
            string tn = (f.TypeName ?? "").Trim();
            if (tn.IndexOf("_link", StringComparison.OrdinalIgnoreCase) >= 0)
                return DpTypeNames.StripNamespaceFromTypeName(tn);
            return DpTypeNames.SchemaFieldToDataType(f);
        }

        /// <summary>
        /// DpSchema를 Excel 헤더용 flat 리스트로 변환.
        /// Struct/List&lt;Struct&gt; 필드는 재귀적으로 하위 필드를 펼침.
        /// resolveTypeName: TypeName → 하위 DpSchema 조회 콜백 (DefineLoader.GetSchemaByTypeName 등).
        /// mainSheetOnly: true이면 list/set/map 필드는 루트 엔트리 1개만 반환 (분리 시트 모드 메인용).
        /// </summary>
        public static List<FlatHeaderField> FlattenSchema(
            DpSchema schema,
            Func<string, DpSchema> resolveTypeName,
            string parentPath = "",
            bool mainSheetOnly = false,
            string parentStructName = null)
        {
            var result = new List<FlatHeaderField>();
            if (schema?.Fields == null) return result;

            var ordered = new List<KeyValuePair<int, DpFieldSchema>>(schema.Fields);
            ordered.Sort((a, b) => a.Value.Order.CompareTo(b.Value.Order));

            foreach (var kv in ordered)
            {
                int fieldId = kv.Key;
                var f = kv.Value;
                string path = string.IsNullOrEmpty(parentPath)
                    ? fieldId.ToString()
                    : parentPath + "." + fieldId;

                bool isContainer = (f.Type == DpSchemaType.List || f.Type == DpSchemaType.Set || f.Type == DpSchemaType.Map);

                if (f.Type == DpSchemaType.Struct && resolveTypeName != null)
                {
                    var nested = resolveTypeName(f.TypeName);
                    if (nested?.Fields != null)
                    {
                        result.Add(new FlatHeaderField
                        {
                            HierarchyId = path,
                            DataType = f.TypeName ?? "record",
                            ColumnName = f.Name ?? "",
                            DocComment = f.DocComment ?? "",
                            IsStructMarker = true,
                            ParentStructName = parentStructName ?? ""
                        });
                        string sn = !string.IsNullOrEmpty(f.TypeName) ? DpTypeNames.StripNamespaceFromTypeName(f.TypeName) : "";
                        string childStructName = !string.IsNullOrEmpty(sn) ? sn : (f.Name ?? "");
                        result.AddRange(FlattenSchema(nested, resolveTypeName, path, mainSheetOnly, childStructName));
                    }
                    else
                        result.Add(new FlatHeaderField
                        {
                            HierarchyId = path,
                            DataType = "record",
                            ColumnName = f.Name ?? "",
                            DocComment = f.DocComment ?? "",
                            ParentStructName = parentStructName ?? ""
                        });
                }
                else if (isContainer && mainSheetOnly)
                {
                    result.Add(new FlatHeaderField
                    {
                        HierarchyId = path,
                        DataType = GetExcelDataTypeForField(f),
                        ColumnName = f.Name ?? "",
                        DocComment = f.DocComment ?? "",
                        ParentStructName = parentStructName ?? ""
                    });
                }
                else if ((f.Type == DpSchemaType.List || f.Type == DpSchemaType.Set) && resolveTypeName != null)
                {
                    string innerTypeName = DpTypeNames.StripOuterGeneric(f.TypeName ?? "");
                    var elemSchema = resolveTypeName(innerTypeName);
                    if (elemSchema?.Fields != null)
                    {
                        result.Add(new FlatHeaderField
                        {
                            HierarchyId = path,
                            DataType = DpTypeNames.ToProtocolName(
                                DpTypeNames.FromSchemaTypeName(f.Type.ToString())),
                            ColumnName = f.Name ?? "",
                            DocComment = f.DocComment ?? "",
                            ParentStructName = parentStructName ?? ""
                        });
                        result.AddRange(FlattenSchema(elemSchema, resolveTypeName, path, mainSheetOnly, parentStructName));
                    }
                    else
                    {
                        result.Add(new FlatHeaderField
                        {
                            HierarchyId = path,
                            DataType = GetExcelDataTypeForField(f),
                            ColumnName = f.Name ?? "",
                            DocComment = f.DocComment ?? "",
                            ParentStructName = parentStructName ?? ""
                        });
                    }
                }
                else
                {
                    result.Add(new FlatHeaderField
                    {
                        HierarchyId = path,
                        DataType = GetExcelDataTypeForField(f),
                        ColumnName = f.Name ?? "",
                        DocComment = f.DocComment ?? "",
                        ParentStructName = parentStructName ?? ""
                    });
                }
            }
            return result;
        }

        #endregion
    }
}
