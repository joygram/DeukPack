@@DOC_COMMENT@@
struct @@STRUCT_NAME@@ : public deuk::IDpSerializable {
@@FIELD_DECL_LINES@@

@@FIELD_ID_LINES@@

  void Write(deuk::DpProtocol& oprot) const override;
  void Read(deuk::DpProtocol& iprot) override;
};
