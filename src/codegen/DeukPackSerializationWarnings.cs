/**
 * DeukPack serialization warnings — 컬럼 누락/변경 시 경고 로그.
 * 모든 시리얼라이저(프로토콜)에서 공통 사용. 앱에서 로거 설정 가능.
 */

using System;

namespace DeukPack.Protocol
{
    /// <summary>
    /// Column missing or unknown field during deserialization: optional warning callback.
    /// Set LogTo to override default (Trace); e.g. Unity: (s, id, name) => UnityEngine.Debug.LogWarning($"DeukPack: {s}").
    /// </summary>
    public static class DeukPackSerializationWarnings
    {
        /// <summary> (structName, fieldId, fieldName) for unknown/extra field in stream. </summary>
        public static Action<string, short, string> OnUnknownField = LogUnknownFieldDefault;

        /// <summary> (structName, fieldName) for required field missing from stream. </summary>
        public static Action<string, string> OnMissingRequiredField = LogMissingRequiredDefault;

        public static void LogUnknownField(string structName, short fieldId, string fieldName)
        {
            (OnUnknownField ?? LogUnknownFieldDefault)(structName ?? "", fieldId, fieldName ?? "");
        }

        public static void LogMissingRequiredField(string structName, string fieldName)
        {
            (OnMissingRequiredField ?? LogMissingRequiredDefault)(structName ?? "", fieldName ?? "");
        }

        private static void LogUnknownFieldDefault(string structName, short fieldId, string fieldName)
        {
#if NETSTANDARD2_0 || NET6_0_OR_GREATER
            System.Diagnostics.Trace.TraceWarning("[DeukPack] Unknown field: struct={0}, fieldId={1}, fieldName={2}", structName, fieldId, fieldName ?? "");
#else
            System.Console.Error.WriteLine($"[DeukPack] Unknown field: struct={structName}, fieldId={fieldId}, fieldName={fieldName ?? ""}");
#endif
        }

        private static void LogMissingRequiredDefault(string structName, string fieldName)
        {
#if NETSTANDARD2_0 || NET6_0_OR_GREATER
            System.Diagnostics.Trace.TraceWarning("[DeukPack] Missing required field: struct={0}, fieldName={1}", structName, fieldName ?? "");
#else
            System.Console.Error.WriteLine($"[DeukPack] Missing required field: struct={structName}, fieldName={fieldName ?? ""}");
#endif
        }
    }
}
