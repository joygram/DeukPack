import { DeukPackAST, DeukPackEnum, DeukPackField, DeukPackType } from '../types/DeukPackTypes';

/**
 * Elixir Code Generator for DeukPack
 * Features Erlang BEAM native Bitstring Pattern Matching (<<tag::integer, rest::binary>>)
 *
 * DpWireType constants (TBinaryProtocol compatible):
 *   BOOL=2, BYTE=3, DOUBLE=4, I16=6, I32=5, I64=10, STRING=11, STRUCT=12, MAP=13, SET=14, LIST=15
 */
export class ElixirGenerator {
  // Wire type constants — must match DpWireType in all language runtimes (Thrift TBinaryProtocol)
  private static readonly WT = {
    BOOL:   2,
    BYTE:   3,
    DOUBLE: 4,
    I16:    6,
    I32:    8,   // TBinaryProtocol: Int32 = 8 (not 5!)
    I64:    10,
    STRING: 11,
    STRUCT: 12,
    MAP:    13,
    SET:    14,
    LIST:   15,
  } as const;

  public async generate(ast: DeukPackAST, options: any): Promise<{ [filename: string]: string }> {
    const files: { [filename: string]: string } = {};
    const elixirModule = options.elixirModule || 'DeukPack.Generated';

    // 1. Generate Enums first (structs may reference them)
    for (const enm of ast.enums) {
      const filename = `${this.toSnakeCase(enm.name)}.ex`;
      files[filename] = this.generateEnum(enm, elixirModule);
    }

    // 2. Generate Structs
    for (const struct of ast.structs) {
      const filename = `${this.toSnakeCase(struct.name)}.ex`;
      files[filename] = this.generateStruct(struct, ast, elixirModule);
    }

    return files;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Struct generation
  // ─────────────────────────────────────────────────────────────────────────────

  private generateStruct(struct: any, ast: DeukPackAST, rootModule: string): string {
    const fields = struct.fields as DeukPackField[];
    const moduleName = `${rootModule}.${struct.name}`;

    const enforceKeys = fields
      .filter((f) => f.required)
      .map((f) => `:${f.name}`)
      .join(', ');

    const noDefaultFields = fields
      .filter((f) => this.defaultValue(f) === null)
      .map((f) => `:${f.name}`)
      .join(', ');

    const defaultFields = fields
      .filter((f) => this.defaultValue(f) !== null)
      .map((f) => `${f.name}: ${this.defaultValue(f)}`)
      .join(', ');

    const defstructParts = [noDefaultFields, defaultFields].filter(Boolean).join(', ');
    const defstruct = defstructParts;

    const typeDef = fields
      .map((f) => `    ${f.name}: ${this.toElixirType(f.type, ast)}`)
      .join(',\n');

    // encode: header (wire_type + field_id) + value bytes per field; skip nils (absent fields)
    const encodeFields = fields
      .map((f) => {
        const wt = this.wireType(f.type, ast);
        const valExpr = this.encodeBitExpr(f.type, `struct.${f.name}`, ast, rootModule);
        return (
          `    # [${f.id}] ${f.name} (wire=${wt})\n` +
          `    acc = if is_nil(struct.${f.name}) do\n` +
          `      acc\n` +
          `    else\n` +
          `      <<acc::binary, ${wt}::8, ${f.id}::16-unsigned, ${valExpr}::binary>>\n` +
          `    end`
        );
      })
      .join('\n');

    // set_field: pattern match on field id — returns an updater fn
    const setFieldClauses = fields
      .map((f) => `  defp set_field(s, ${f.id}), do: fn v -> %{s | ${f.name}: v} end`)
      .join('\n');

    const decodeSel = this.generateDecodeBlock(moduleName, struct, ast, rootModule);

    // ── Field type analysis ───────────────────────────────────────────────────
    // encode_field is only generated if encodeBitExpr dynamically falls back to it
    const needsEncodeField = encodeFields.includes('encode_field(');
    // For decode, we check the actual AST types
    const hasDecodeList = fields.some(f => {
      const t = typeof f.type === 'string' ? null : (f.type as any).type;
      return t === 'list' || t === 'array' || t === 'set';
    });
    const hasDecodeMap = fields.some(f => {
      const t = typeof f.type === 'string' ? null : (f.type as any).type;
      return t === 'map';
    });

    // ── Conditional encode helpers ─────────────────────────────────────────────
    // If encode_field is needed, it acts as a dynamic runtime encoder, so we
    // must supply all its helper functions (list, map, integer) to avoid missing clauses.
    const encodeFieldBlock = needsEncodeField ? `
  # ── Field encoder ─────────────────────────────────────────────────────────────
  defp encode_field(nil),                     do: {<<>>, <<>>}
  defp encode_field(v) when is_boolean(v),    do: {<<>>, <<(if v, do: 1, else: 0)::8>>}
  defp encode_field(v) when is_float(v),      do: {<<>>, <<v::float-64-big>>}
  defp encode_field(v) when is_integer(v),    do: encode_integer(v)
  defp encode_field(v) when is_binary(v) do
    len = byte_size(v)
    {<<>>, <<len::32-big, v::binary>>}
  end
  defp encode_field(v) when is_list(v) do
    {elem_wt, items_bin} = encode_list_items(v)
    count = length(v)
    {<<>>, <<elem_wt::8, count::32-big, items_bin::binary>>}
  end
  defp encode_field(v) when is_map(v) and not is_struct(v) do
    {k_wt, v_wt, pairs_bin} = encode_map_pairs(Map.to_list(v))
    count = map_size(v)
    {<<>>, <<k_wt::8, v_wt::8, count::32-big, pairs_bin::binary>>}
  end
  defp encode_field(v) when is_struct(v) do
    mod = v.__struct__
    {<<>>, mod.encode(v)}
  end

  defp encode_integer(v) when v >= -128        and v <= 127,        do: {<<>>, <<v::8-signed>>}
  defp encode_integer(v) when v >= -32768      and v <= 32767,      do: {<<>>, <<v::16-big-signed>>}
  defp encode_integer(v) when v >= -2147483648 and v <= 2147483647, do: {<<>>, <<v::32-big-signed>>}
  defp encode_integer(v),                                            do: {<<>>, <<v::64-big-signed>>}

  defp encode_list_items([]), do: {11, <<>>}
  defp encode_list_items([h | _] = list) do
    elem_wt = infer_wire_type(h)
    items_bin = Enum.reduce(list, <<>>, fn item, acc2 ->
      {_, bin} = encode_field(item)
      <<acc2::binary, bin::binary>>
    end)
    {elem_wt, items_bin}
  end

  defp encode_map_pairs([]), do: {11, 5, <<>>}
  defp encode_map_pairs([{k, v} | _] = pairs) do
    k_wt = infer_wire_type(k)
    v_wt = infer_wire_type(v)
    pairs_bin = Enum.reduce(pairs, <<>>, fn {ek, ev}, acc2 ->
      {_, kb} = encode_field(ek)
      {_, vb} = encode_field(ev)
      <<acc2::binary, kb::binary, vb::binary>>
    end)
    {k_wt, v_wt, pairs_bin}
  end

  defp infer_wire_type(v) when is_boolean(v), do: 2
  defp infer_wire_type(v) when is_float(v),   do: 4
  defp infer_wire_type(v) when is_integer(v), do: 8
  defp infer_wire_type(v) when is_binary(v),  do: 11
  defp infer_wire_type(v) when is_list(v),    do: 15
  defp infer_wire_type(v) when is_map(v),     do: 13
  defp infer_wire_type(_),                    do: 12
` : '';

    return `defmodule ${moduleName} do
  @moduledoc """
  DeukPack Generated Struct: ${struct.name}
  TBinaryProtocol-compatible encoder/decoder via BEAM Bitstring pattern matching.
  """

  ${enforceKeys.length > 0 ? `@enforce_keys [${enforceKeys}]` : ''}
  defstruct [${defstruct}]

  @type t :: %__MODULE__{
${typeDef}
  }

  @max_safe_length 10485760

  defp check_len!(len) when len > @max_safe_length, do: raise "Protocol buffer overflow: length \#{len} exceeds max size \#{@max_safe_length}"
  defp check_len!(len), do: len

${decodeSel}

  @doc "Encodes struct into TBinaryProtocol-compatible wire bytes."
  def encode(%__MODULE__{} = struct) do
    acc = <<>>
${encodeFields}
    <<acc::binary, 0::8>>
  end

  # ── Unified DeukPack Serialization API ────────────────────────────────────────

  @doc "Packs the struct into binary bytes or JSON string."
  @spec pack(t(), atom()) :: binary()
  def pack(%__MODULE__{} = struct, format \\\\ :binary) do
    if format == :json do
      if Code.ensure_loaded?(Jason), do: Jason.encode!(Map.from_struct(struct)), else: raise "Jason module not found for to_json"
    else
      encode(struct)
    end
  end

  @doc \"\"\"
  Unpacks bytes into a new struct instance. (Factory Method)
  Standard method for BEAM VM, taking advantage of per-process GC for short-lived data.
  \"\"\"
  @spec unpack(binary()) :: t()
  def unpack(bytes) when is_binary(bytes), do: unpack(bytes, :binary)

  @spec unpack(binary(), atom()) :: t()
  def unpack(bytes, format) when is_binary(bytes) do
    if format == :json do
      if Code.ensure_loaded?(Jason), do: Jason.decode!(bytes, keys: :atoms) |> struct(__MODULE__), else: raise "Jason module not found for from_json"
    else
      decode("binary", bytes, %__MODULE__{}) |> elem(0)
    end
  end

  @doc \"\"\"
  Unpacks bytes into an existing struct instance. (In-Place Update)
  Merging deeply nested properties into an existing struct. Note: BEAM immutability means this still allocates a new struct internally.
  \"\"\"
  @spec unpack(t(), binary()) :: t()
  def unpack(%__MODULE__{} = struct, bytes) when is_binary(bytes) do
    unpack(struct, bytes, :binary)
  end

  @spec unpack(t(), binary(), atom()) :: t()
  def unpack(%__MODULE__{} = struct, bytes, format) do
    if format == :json do
      if Code.ensure_loaded?(Jason), do: struct!(struct, Jason.decode!(bytes, keys: :atoms)), else: raise "Jason module not found for from_json"
    else
      decode("binary", bytes, struct) |> elem(0)
    end
  end
${encodeFieldBlock}
  # ── Field decoder ─────────────────────────────────────────────────────────────
  # Type 2=bool 3=byte 4=double 5=i32 6=i16 10=i64 11=string 12=struct 13=map 14=set 15=list

  defp decode_field(2,  <<v::8,             rest::binary>>), do: {v != 0,  rest}
  defp decode_field(3,  <<v::8-signed,      rest::binary>>), do: {v,       rest}
  defp decode_field(6,  <<v::16-big-signed, rest::binary>>), do: {v,       rest}
  defp decode_field(8,  <<v::32-big-signed, rest::binary>>), do: {v,       rest}
  defp decode_field(5,  <<v::32-big-signed, rest::binary>>), do: {v,       rest}
  defp decode_field(10, <<v::64-big-signed, rest::binary>>), do: {v,       rest}
  defp decode_field(4,  <<v::float-64-big,  rest::binary>>), do: {v,       rest}
  defp decode_field(11, <<len::32-big, rest::binary>>) do
    check_len!(len)
    if byte_size(rest) < len, do: raise "Protocol buffer overflow: string length exceeds remaining bytes"
    <<v::binary-size(len), rest2::binary>> = rest
    {v, rest2}
  end
${hasDecodeList ? `
  defp decode_field(15, <<elem_type::8, count::32-big, rest::binary>>) do
    check_len!(count)
    decode_list(elem_type, count, rest, [])
  end
  defp decode_field(14, <<elem_type::8, count::32-big, rest::binary>>) do
    check_len!(count)
    decode_list(elem_type, count, rest, [])
  end` : ''}${hasDecodeMap ? `
  defp decode_field(13, <<k_type::8, v_type::8, count::32-big, rest::binary>>) do
    check_len!(count)
    decode_map(k_type, v_type, count, rest, %{})
  end` : ''}
  defp decode_field(12, rest), do: skip_struct(rest)
  defp decode_field(_,  rest), do: {nil, rest}

  # skip_struct: consume all fields until STOP byte without building a value
  defp skip_struct(<<0::8, rest::binary>>),                    do: {nil, rest}
  defp skip_struct(<<type::8, _id::16, rest::binary>>),        do: skip_struct_field(type, rest)
  defp skip_struct(<<>>),                                      do: {nil, <<>>}

  defp skip_struct_field(2,  <<_::8,             r::binary>>), do: skip_struct(r)
  defp skip_struct_field(3,  <<_::8,             r::binary>>), do: skip_struct(r)
  defp skip_struct_field(6,  <<_::16,            r::binary>>), do: skip_struct(r)
  defp skip_struct_field(8,  <<_::32,            r::binary>>), do: skip_struct(r)
  defp skip_struct_field(5,  <<_::32,            r::binary>>), do: skip_struct(r)
  defp skip_struct_field(10, <<_::64,            r::binary>>), do: skip_struct(r)
  defp skip_struct_field(4,  <<_::64,            r::binary>>), do: skip_struct(r)
  defp skip_struct_field(11, <<len::32-big, rest::binary>>) do
    check_len!(len)
    if byte_size(rest) < len, do: raise "Protocol buffer overflow: string length exceeds remaining bytes"
    <<_::binary-size(len), r::binary>> = rest
    skip_struct(r)
  end
  defp skip_struct_field(12, rest) do
    {_, r} = skip_struct(rest)
    skip_struct(r)
  end
  defp skip_struct_field(15, <<et::8, cnt::32-big, r::binary>>) do
    check_len!(cnt)
    skip_list(cnt, et, r)
  end
  defp skip_struct_field(13, <<kt::8, vt::8, cnt::32-big, r::binary>>) do
    check_len!(cnt)
    skip_map(cnt, kt, vt, r)
  end
  defp skip_struct_field(_, r), do: {nil, r}

  defp skip_list(0, _et, r), do: skip_struct(r)
  defp skip_list(n, 11, <<len::32-big, rest::binary>>) do
    check_len!(len)
    if byte_size(rest) < len, do: raise "Protocol buffer overflow: string length exceeds remaining bytes"
    <<_::binary-size(len), r::binary>> = rest
    skip_list(n-1, 11, r)
  end
  defp skip_list(n, 8,  <<_::32, r::binary>>),                            do: skip_list(n-1, 8, r)
  defp skip_list(n, 5,  <<_::32, r::binary>>),                            do: skip_list(n-1, 5, r)
  defp skip_list(n, 10, <<_::64, r::binary>>),                            do: skip_list(n-1, 10, r)
  defp skip_list(n, 2,  <<_::8,  r::binary>>),                            do: skip_list(n-1, 2, r)
  defp skip_list(n, 3,  <<_::8,  r::binary>>),                            do: skip_list(n-1, 3, r)
  defp skip_list(_n, _et, r), do: skip_struct(r)

  defp skip_map(0, _kt, _vt, r), do: skip_struct(r)
  defp skip_map(n, 11, 8, <<kl::32-big, _::binary-size(kl), _::32, r::binary>>), do: skip_map(n-1, 11, 8, r)
  defp skip_map(_n, _kt, _vt, r), do: skip_struct(r)

${hasDecodeList ? `
  defp decode_list(_type, 0, rest, acc),   do: {Enum.reverse(acc), rest}
  defp decode_list(type, n, rest, acc) do
    {val, rest2} = decode_field(type, rest)
    decode_list(type, n - 1, rest2, [val | acc])
  end` : ''}${hasDecodeMap ? `

  defp decode_map(_kt, _vt, 0, rest, acc), do: {acc, rest}
  defp decode_map(kt, vt, n, rest, acc) do
    {key, rest2} = decode_field(kt, rest)
    {val, rest3} = decode_field(vt, rest2)
    decode_map(kt, vt, n - 1, rest3, Map.put(acc, key, val))
  end` : ''}

  # ── Field id → struct key setter ─────────────────────────────────────────────
${setFieldClauses}
  defp set_field(s, _id), do: fn _ -> s end

end
`;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Decode Expressions
  // ─────────────────────────────────────────────────────────────────────────────

  /** Returns whether the expression references `depth` (i.e. is a recursive struct decode). */
  private exprUsesDepth(type: DeukPackType, ast: DeukPackAST): boolean {
    if (typeof type === 'string') {
      return this.wireType(type, ast) === ElixirGenerator.WT.STRUCT;
    }
    const t = (type as any).type;
    if (t === 'list' || t === 'array') return this.exprUsesDepth((type as any).elementType, ast);
    if (t === 'map') return this.exprUsesDepth((type as any).keyType, ast) || this.exprUsesDepth((type as any).valueType, ast);
    return false;
  }

  private generateDecodeHelper(type: DeukPackType, restVar: string, ast: DeukPackAST, rootModule: string): string {
    if (typeof type === 'string') {
      const wt = this.wireType(type, ast);
      if (wt === ElixirGenerator.WT.STRUCT) {
        // Use apply/3 to avoid cross-module arity warning when nested module is compiled later
        return `apply(${rootModule}.${type}, :decode, ["binary", ${restVar}, struct(${rootModule}.${type}), depth + 1])`;
      }
      return `decode_field(${wt}, ${restVar})`;
    }
    const t = (type as any).type;
    if (t === 'list' || t === 'array') {
      const elemWT = this.wireType((type as any).elementType, ast);
      const elemLambda = `fn r -> ${this.generateDecodeHelper((type as any).elementType, 'r', ast, rootModule)} end`;
      return `(
        <<${elemWT}::8, count::32-big-signed, r1::binary>> = ${restVar}
        if count < 0 or count > 1000000, do: raise "Protocol buffer overflow: list element count #{count} out of safe range"
        decode_typed_list(count, r1, ${elemLambda}, [])
      )`;
    }
    if (t === 'map') {
      const kwt = this.wireType((type as any).keyType, ast);
      const vwt = this.wireType((type as any).valueType, ast);
      const kLambda = `fn r -> ${this.generateDecodeHelper((type as any).keyType, 'r', ast, rootModule)} end`;
      const vLambda = `fn r -> ${this.generateDecodeHelper((type as any).valueType, 'r', ast, rootModule)} end`;
      return `(
        <<${kwt}::8, ${vwt}::8, count::32-big-signed, r1::binary>> = ${restVar}
        if count < 0 or count > 1000000, do: raise "Protocol buffer overflow: map element count #{count} out of safe range"
        decode_typed_map(count, r1, ${kLambda}, ${vLambda}, %{})
      )`;
    }
    return `skip_struct_field(12, ${restVar})`;
  }

  private generateDecodeBlock(moduleName: string, struct: any, ast: DeukPackAST, rootModule: string): string {
    const fields = struct.fields as DeukPackField[];
    const hasMapFields = fields.some(f => {
      const t = typeof f.type === 'string' ? null : (f.type as any).type;
      return t === 'map';
    });
    const hasListFields = fields.some(f => {
      const t = typeof f.type === 'string' ? null : (f.type as any).type;
      return t === 'list' || t === 'array' || t === 'set';
    });

    const decodeSpecific = fields.map((f: DeukPackField) => {
      const usesDepth = this.exprUsesDepth(f.type, ast);
      const depthParam = usesDepth ? 'depth' : '_depth';
      const expr = this.generateDecodeHelper(f.type, 'rest', ast, rootModule);
      return `  defp decode_specific(${f.id}, ${this.wireType(f.type, ast)}, rest, ${depthParam}), do: ${expr}`;
    }).join('\n');

    const typedListHelper = (hasListFields || hasMapFields) ? `
  defp decode_typed_list(0, rest, _decoder, acc), do: {Enum.reverse(acc), rest}
  defp decode_typed_list(n, rest, decoder, acc) do
    {val, rest2} = decoder.(rest)
    decode_typed_list(n - 1, rest2, decoder, [val | acc])
  end` : '';

    const typedMapHelper = hasMapFields ? `

  defp decode_typed_map(0, rest, _kdec, _vdec, acc), do: {acc, rest}
  defp decode_typed_map(n, rest, kdec, vdec, acc) do
    {key, rest2} = kdec.(rest)
    {val, rest3} = vdec.(rest2)
    decode_typed_map(n - 1, rest3, kdec, vdec, Map.put(acc, key, val))
  end` : '';

    return `  @doc """
  Decodes TBinaryProtocol wire bytes into %${moduleName}{}.
  protocol: "pack" | "binary" | "json"
  Returns {struct, remaining_bytes}
  """
  def decode(protocol, bytes, struct, depth \\\\ 0)
  def decode(_protocol, <<>>, struct, _depth), do: {struct, <<>>}
  def decode(_protocol, <<0::8, rest::binary>>, struct, _depth), do: {struct, rest}
  def decode("json", rest, struct, _depth), do: {struct, rest}
  def decode("yaml", rest, struct, _depth), do: {struct, rest}
  def decode(protocol, <<type::8, id::16-unsigned, rest::binary>>, struct, depth) do
    if depth > 64, do: raise "Protocol buffer overflow: MAX_RECURSION_DEPTH 64 exceeded"
    {value, rest2} = decode_specific(id, type, rest, depth)
    setter = set_field(struct, id)
    decode(protocol, rest2, setter.(value), depth)
  end
  def decode(_protocol, rest, struct, _depth), do: {struct, rest}

${decodeSpecific}
  defp decode_specific(_id, type, rest, _depth), do: skip_struct_field(type, rest)
${typedListHelper}${typedMapHelper}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Enum generation
  // ─────────────────────────────────────────────────────────────────────────────

  private generateEnum(enm: DeukPackEnum, rootModule: string): string {
    const moduleName = `${rootModule}.${enm.name}`;
    // Group all to_integer clauses together (including fallback)
    const toIntegerClauses = [
      ...Object.entries(enm.values).map(([name, value]) => `  def to_integer(:${name}), do: ${value}`),
      `  def to_integer(_), do: 0`
    ].join('\n');

    // Group all from_integer clauses together (including fallback)
    const fromIntegerClauses = [
      ...Object.entries(enm.values).map(([name, value]) => `  def from_integer(${value}), do: :${name}`),
      `  def from_integer(_), do: nil`
    ].join('\n');

    return `defmodule ${moduleName} do
  @moduledoc """
  DeukPack Generated Enum: ${enm.name}
  ${enm.docComment || ''}
  """

${toIntegerClauses}

${fromIntegerClauses}
end
`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Wire type mapping (DeukPack type → DpWireType integer)
  // ─────────────────────────────────────────────────────────────────────────────

  private wireType(type: DeukPackType, ast?: DeukPackAST): number {
    const WT = ElixirGenerator.WT;
    if (typeof type === 'string') {
      switch (type) {
        case 'bool':   return WT.BOOL;
        case 'int8':
        case 'byte':   return WT.BYTE;
        case 'int16':  return WT.I16;
        case 'int32':  return WT.I32;
        case 'int64':  return WT.I64;
        case 'float':
        case 'double': return WT.DOUBLE;
        case 'string':
        case 'binary': return WT.STRING;
        default:
          if (ast && ast.enums.some(e => e.name === type)) return WT.I32;
          return WT.STRUCT;
      }
    }
    const t = (type as any).type;
    if (t === 'list' || t === 'array') return WT.LIST;
    if (t === 'set')                   return WT.SET;
    if (t === 'map')                   return WT.MAP;
    return WT.STRUCT;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Elixir typespec string
  // ─────────────────────────────────────────────────────────────────────────────

  private toElixirType(type: DeukPackType, ast: DeukPackAST): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool':   return 'boolean()';
        case 'byte':
        case 'int8':
        case 'int16':
        case 'int32':
        case 'int64':  return 'integer()';
        case 'float':
        case 'double': return 'float()';
        case 'string': return 'String.t()';
        case 'binary': return 'binary()';
        default:       return 'any()';
      }
    }
    const t = (type as any).type;
    if (t === 'list' || t === 'array') return `[${this.toElixirType((type as any).elementType, ast)}]`;
    if (t === 'set')  return `MapSet.t(${this.toElixirType((type as any).elementType, ast)})`;
    if (t === 'map') {
      const kt = this.toElixirType((type as any).keyType, ast);
      const vt = this.toElixirType((type as any).valueType, ast);
      return `%{${kt} => ${vt}}`;
    }
    return 'any()';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Default value literal for defstruct
  // ─────────────────────────────────────────────────────────────────────────────

  private defaultValue(field: DeukPackField): string | null {
    if (field.defaultValue === undefined || field.defaultValue === null) return null;
    const v = field.defaultValue;
    const t = field.type;
    if (typeof t === 'string') {
      if (t === 'bool')   return v ? 'true' : 'false';
      if (t === 'string') return `"${String(v).replace(/"/g, '\\"')}"`;
      if (['int8','int16','int32','int64','float','double','byte'].includes(t)) return String(v);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Type-fixed encode bit expression — returns a bitstring segment expression
  // e.g. "<<v::32-big-signed>>" style without outer << >> wrapper
  // ─────────────────────────────────────────────────────────────────────────────

  private encodeBitExpr(type: DeukPackType, varName: string, ast?: DeukPackAST, rootModule?: string): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'bool':   return `(if ${varName}, do: <<1::8>>, else: <<0::8>>)`;
        case 'int8':
        case 'byte':   return `<<${varName}::8-signed>>`;
        case 'int16':  return `<<${varName}::16-big-signed>>`;
        case 'int32':  return `<<${varName}::32-big-signed>>`;
        case 'int64':  return `<<${varName}::64-big-signed>>`;
        case 'float':  return `<<${varName}::float-64-big>>`;
        case 'double': return `<<${varName}::float-64-big>>`;
        case 'string':
        case 'binary': return `<<byte_size(${varName})::32-big, ${varName}::binary>>`;
        default: {
          // Enum: encode as i32 via to_integer/1
          if (ast && ast.enums.some(e => e.name === type)) {
            const mod = rootModule ? `${rootModule}.${type}` : type;
            return `<<apply(${mod}, :to_integer, [${varName}])::32-big-signed>>`;
          }
          // Struct: use encode_field (requires encode_field to be in scope)
          return `(encode_field(${varName}) |> elem(1))`;
        }
      }
    }
    const t = (type as any).type;
    if (t === 'list' || t === 'array') {
      const elemType = (type as any).elementType;
      const elemWT = this.wireType(elemType, ast);
      const elemExpr = this.encodeBitExpr(elemType, 'item', ast, rootModule);
      return `(
        items_bin = Enum.reduce(${varName}, <<>>, fn item, acc_lst ->
          <<acc_lst::binary, ${elemExpr}::binary>>
        end)
        <<${elemWT}::8, length(${varName})::32-big, items_bin::binary>>
      )`;
    }
    if (t === 'map') {
      const kt = (type as any).keyType;
      const vt = (type as any).valueType;
      const kwt = this.wireType(kt, ast);
      const vwt = this.wireType(vt, ast);
      const kExpr = this.encodeBitExpr(kt, 'ek', ast, rootModule);
      const vExpr = this.encodeBitExpr(vt, 'ev', ast, rootModule);
      return `(
        pairs_bin = Enum.reduce(${varName}, <<>>, fn {ek, ev}, acc_map ->
          <<acc_map::binary, ${kExpr}::binary, ${vExpr}::binary>>
        end)
        <<${kwt}::8, ${vwt}::8, map_size(${varName})::32-big, pairs_bin::binary>>
      )`;
    }
    // struct mapping remains dynamic via encode_field
    return `(encode_field(${varName}) |> elem(1))`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }
}
