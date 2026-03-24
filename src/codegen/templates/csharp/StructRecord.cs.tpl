@@DOC_BLOCK@@

@@STRUCT_ATTRS@@@@TABLE_ATTR@@  [System.Serializable]
  public partial class @@CLASS_NAME@@ : @@IMPL_LIST@@
  {
@@FIELDS@@@@FIELD_ID_BLOCK@@@@DEFAULT_BLOCK@@
    // Serialization methods
    public void Write(DpProtocol oprot) => Write(oprot, null, null);

    public void Write(DpProtocol oprot, ICollection<int>? fieldIds, Dictionary<int, object>? overrides = null)
    {
@@WRITE_UNIFIED_INNER@@
    }

    public void Read(DpProtocol iprot)
    {
@@READ_INIT_LINES@@
      DpColumn field;
      iprot.ReadStructBegin();
      while (true)
      {
        field = iprot.ReadFieldBegin();
        if (field.Type == DpWireType.Stop)
        {
          break;
        }
        switch (field.ID)
        {
@@READ_SWITCH_CASES@@
          default:
            DeukPack.Protocol.DeukPackSerializationWarnings.LogUnknownField("@@WIRE_NAME@@", field.ID, field.Name ?? "");
            DpProtocolUtil.Skip(iprot, field.Type);
            break;
        }
        iprot.ReadFieldEnd();
      }
      iprot.ReadStructEnd();
@@READ_MISSING_REQUIRED_CHECKS@@
    }

    // Clone method
    public @@CLASS_NAME@@ Clone()
    {
      var clone = new @@CLASS_NAME@@();
@@CLONE_LINES@@
      return clone;
    }

    // Explicit interface implementation
    object IDeukPack.Clone()
    {
      return this.Clone();
    }

    // CreateDefault: recursive default instance
    public static @@CLASS_NAME@@ CreateDefault()
    {
      var o = new @@CLASS_NAME@@();
@@CREATE_DEFAULT_LINES@@
      return o;
    }

    public override string ToString() { return ToString(""); }
    public string ToString(string indent)
    {
      var sb = new StringBuilder();
      var ci = indent + "  ";
      sb.Append("@@WIRE_NAME@@ {");
@@TOSTRING_INNER@@
      return sb.ToString();
    }

    // Schema metadata
    public static DpSchema GetSchema()
    {
      return SchemaInfo.Value;
    }

    private static readonly Lazy<DpSchema> SchemaInfo = new Lazy<DpSchema>(() =>
    {
      var schema = new DpSchema
      {
        Name = "@@WIRE_NAME@@",
        Type = DpDefinitionKind.Struct,
        DocComment = @@STRUCT_DOC@@,
        Annotations = @@STRUCT_ANN@@,
        Fields = new Dictionary<int, DpFieldSchema>
        {
@@SCHEMA_FIELD_LINES@@
        }
      };
      return schema;
    });
@@META_CONTAINER_BLOCK@@
  }
