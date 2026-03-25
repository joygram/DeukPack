/**
 * DpDeukYamlProtocol — Deuk YAML (값만) 프로토콜.
 * DpDeukJsonProtocol 과 동일한 필드 트리; 루트 직렬화만 YAML.
 * See: DeukPack/docs/DEUKPACK_DEUK_JSON_YAML.md
 */
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using YamlDotNet.RepresentationModel;
using YamlDotNet.Serialization;

namespace DeukPack.Protocol
{
    /// <summary>
    /// Deuk YAML protocol: value-only YAML for config/OpenAPI round-trip (TS <c>protocol: 'yaml'</c> 와 같은 계열).
    /// </summary>
    public class DpDeukYamlProtocol : DpDeukJsonProtocol
    {
        public DpDeukYamlProtocol(Stream stream, bool pretty = false, bool includeDeukHeader = true, bool isReadMode = true)
            : base(stream, pretty, includeDeukHeader, isReadMode, isReadMode ? ReadYamlRootFromStream(stream) : new Dictionary<string, object>())
        {
        }

        private static Dictionary<string, object> ReadYamlRootFromStream(Stream stream)
        {
            var utf8 = new UTF8Encoding(false);
            using (var sr = new StreamReader(stream, utf8, false, 4096, true))
            {
                var text = sr.ReadToEnd();
                if (string.IsNullOrWhiteSpace(text))
                    return new Dictionary<string, object>();
                return YamlRootToDictionary(text);
            }
        }

        protected override void FlushRootDocument(Stream stream, Dictionary<string, object> document, bool pretty)
        {
            var builder = new SerializerBuilder();
            if (pretty)
                builder = builder.WithIndentedSequences();
            var serializer = builder
                .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
                .DisableAliases()
                .Build();
            var yaml = serializer.Serialize(document);
            var bytes = Encoding.UTF8.GetBytes(yaml);
            stream.Write(bytes, 0, bytes.Length);
            stream.Flush();
        }

        private static Dictionary<string, object> YamlRootToDictionary(string yaml)
        {
            using var reader = new StringReader(yaml);
            var ys = new YamlStream();
            ys.Load(reader);
            if (ys.Documents.Count == 0)
                return new Dictionary<string, object>();
            if (ys.Documents[0].RootNode is YamlMappingNode map)
                return MappingToDict(map);
            return new Dictionary<string, object>();
        }

        private static Dictionary<string, object> MappingToDict(YamlMappingNode map)
        {
            var d = new Dictionary<string, object>();
            foreach (var child in map.Children)
            {
                var key = child.Key.ToString();
                d[key] = NodeToValue(child.Value);
            }
            return d;
        }

        private static object NodeToValue(YamlNode node)
        {
            switch (node)
            {
                case YamlMappingNode m:
                    return MappingToDict(m);
                case YamlSequenceNode seq:
                {
                    var list = new List<object>();
                    foreach (var n in seq.Children)
                        list.Add(NodeToValue(n));
                    return list;
                }
                case YamlScalarNode s:
                    return ScalarToValue(s);
                default:
                    return "";
            }
        }

        private static object ScalarToValue(YamlScalarNode s)
        {
            var v = s.Value ?? "";
            if (v.Length == 0 || v == "~")
                return "";
            if (string.Equals(v, "null", StringComparison.OrdinalIgnoreCase))
                return "";
            if (string.Equals(v, "true", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(v, "false", StringComparison.OrdinalIgnoreCase)) return false;
            if (long.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l))
                return l;
            if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
                return d;
            return v;
        }

        /// <summary>struct 를 Deuk YAML(값만)로 스트림에 기록.</summary>
        public static void ToDeukYaml(Stream stream, IDpSerializable value, bool includeDeukHeader = true, bool pretty = true)
        {
            if (stream == null || value == null) return;
            using (var prot = new DpDeukYamlProtocol(stream, pretty, includeDeukHeader, isReadMode: false))
                value.Write(prot);
        }

        /// <summary>Deuk YAML 스트림에서 struct 채우기.</summary>
        public static void FromDeukYaml(Stream stream, IDpSerializable value)
        {
            if (stream == null || value == null) return;
            using (var prot = new DpDeukYamlProtocol(stream, false, includeDeukHeader: true, isReadMode: true))
                value.Read(prot);
        }
    }
}
