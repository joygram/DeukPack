/**
 * DeukPack Table Manager
 * meta_packed 디렉터리에 파일 단위로 저장된 득팩 테이블을 로드·보관.
 * 기존 MetaManager와 별도 구성. 엑셀 분리 전까지 DeukPack 라이브러리에 포함.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DeukPack.Meta
{
	/// <summary>
	/// 득팩 테이블 packed 디렉터리에서 파일 단위 로드. 카테고리별 역직렬화는 콜백으로 프로젝트가 제공.
	/// </summary>
	public class DeukTableManager
	{
		readonly Dictionary<string, object> _tables = new Dictionary<string, object>();
		Func<string, byte[], object> _deserializer;

		/// <summary>로드된 카테고리 목록</summary>
		public IReadOnlyList<string> Categories => _tables.Keys.ToList();

		/// <summary>카테고리별 역직렬화 함수 설정. (category, rawBytes) => deserializedContainer</summary>
		public void SetDeserializer(Func<string, byte[], object> deserializer)
		{
			_deserializer = deserializer;
		}

		/// <summary>테이블 비우기</summary>
		public void Clear()
		{
			_tables.Clear();
		}

		/// <summary>
		/// meta_packed 디렉터리에서 *.dpk 파일 단위 로드. 선택적으로 파일 단위 복호화.
		/// </summary>
		/// <param name="dir">메타 팩 디렉터리 (예: meta_packed)</param>
		/// <param name="decryptor">null이면 복호화 없음</param>
		/// <returns>로드된 파일 수. 역직렬화 실패 시 예외 또는 무시(구현에 따라)</returns>
		public int LoadFromDirectory(string dir, IDeukMetaDecryptor decryptor = null)
		{
			if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
				return 0;

			var di = new DirectoryInfo(dir);
			var files = di.GetFiles("*.*")
				.Where(f => f.Extension.Equals(".dpk", StringComparison.OrdinalIgnoreCase))
				.ToList();

			int loaded = 0;
			foreach (var fi in files)
			{
				string fileName = Path.GetFileNameWithoutExtension(fi.Name);
				string category = fileName.Contains("@") ? fileName.Split('@')[0] : fileName;
				if (string.IsNullOrEmpty(category))
					continue;

				byte[] raw;
				try
				{
					raw = File.ReadAllBytes(fi.FullName);
				}
				catch
				{
					continue;
				}

				if (raw == null || raw.Length == 0)
					continue;

				byte[] buffer = raw;
				if (decryptor != null)
				{
					try
					{
						buffer = decryptor.Decrypt(raw);
						if (buffer == null || buffer.Length == 0)
							continue;
					}
					catch
					{
						continue;
					}
				}

				if (_deserializer == null)
					continue;

				try
				{
					var obj = _deserializer(category, buffer);
					if (obj != null)
					{
						_tables[category] = obj;
						loaded++;
					}
				}
				catch
				{
					// 프로젝트에서 로깅 가능하도록 콜백 추가 가능
				}
			}

			return loaded;
		}

		/// <summary>로드된 카테고리 테이블 반환. 없으면 default.</summary>
		public T GetTable<T>(string category)
		{
			if (_tables.TryGetValue(category, out var o) && o is T t)
				return t;
			return default;
		}

		/// <summary>컨테이너 타입에서 카테고리 추론 후 테이블 반환. 예: GetTable&lt;mo_skill_meta.container&gt;() → "mo_skill".</summary>
		/// <remarks>규칙: T의 네임스페이스가 "_meta"로 끝나면 제거한 값이 카테고리 (mo_skill_meta → mo_skill).</remarks>
		public T GetTable<T>() where T : class
		{
			string category = InferCategoryFromContainerType(typeof(T));
			return string.IsNullOrEmpty(category) ? default : GetTable<T>(category);
		}

		/// <summary>row 타입만으로 데이터 접근. container 중첩 없이 GetData&lt;mo_skill_meta.data&gt;() 로 meta_id→row 딕셔너리 반환.</summary>
		/// <remarks>규칙: TRow 네임스페이스 *_meta → 카테고리 *. 설계상 container는 내부 구현, 사용처는 row 타입만 알면 됨.</remarks>
		public IReadOnlyDictionary<long, TRow> GetData<TRow>() where TRow : class, DeukPack.Protocol.IDeukPack
		{
			string category = InferCategoryFromContainerType(typeof(TRow));
			if (string.IsNullOrEmpty(category) || !_tables.TryGetValue(category, out var o)) return null;
			if (o is DeukPack.Protocol.IDeukMetaContainer<TRow> typed) return typed.Data;
			return null;
		}

		/// <summary>_meta 네임스페이스에서 카테고리 추론 (mo_skill_meta → mo_skill). container/row 타입 모두 동일 규칙.</summary>
		public static string InferCategoryFromContainerType(Type containerType)
		{
			if (containerType == null) return null;
			string ns = containerType.Namespace ?? "";
			return ns.EndsWith("_meta", StringComparison.Ordinal) ? ns.Substring(0, ns.Length - 5) : ns;
		}

		/// <summary>카테고리 로드 여부</summary>
		public bool HasCategory(string category)
		{
			return _tables.ContainsKey(category);
		}
	}
}
