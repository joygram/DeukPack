const fs = require('fs');
let file = 'src/codegen/ElixirGenerator.ts';
let c = fs.readFileSync(file, 'utf8');

// 1. Fix _et, _kt, _vt
c = c.replace(/<<_et::8/g, '<<et::8');
c = c.replace(/skip_list\(cnt, _et, r\)/g, 'skip_list(cnt, et, r)');
c = c.replace(/<<_kt::8, _vt::8/g, '<<kt::8, vt::8');
c = c.replace(/skip_map\(cnt, _kt, _vt, r\)/g, 'skip_map(cnt, kt, vt, r)');

// 2. Fix decode fallback and default args
const oldDecode = `  def decode(_protocol, <<>>, struct, _depth \\ 0), do: {struct, <<>>}
  def decode(_protocol, <<0::8, rest::binary>>, struct, _depth \\ 0), do: {struct, rest}
  def decode(protocol, <<type::8, id::16-unsigned, rest::binary>>, struct, depth \\ 0) do
    if depth > 64, do: raise "Protocol buffer overflow: MAX_RECURSION_DEPTH 64 exceeded"
    {value, rest2} = decode_specific(id, type, rest, depth)
    setter = set_field(struct, id)
    decode(protocol, rest2, setter.(value), depth)
  end`;

const newDecode = `  def decode(protocol \\ nil, bytes \\ <<>>, struct, depth \\ 0)
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
  def decode(_protocol, rest, struct, _depth), do: {struct, rest}`;

c = c.replace(oldDecode, newDecode);

// 3. Fix wireType signature logic
const oldWireType = `  private wireType(type: DeukPackType): number {
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
        default:       return WT.STRUCT;
      }
    }`;

const newWireType = `  private wireType(type: DeukPackType, ast?: DeukPackAST): number {
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
    }`;
c = c.replace(oldWireType, newWireType);

// 4. Update all wireType calls
// We match `this.wireType(` and then find the closing `)` manually or safely via regex since there are no nested parens in the args.
c = c.replace(/this\.wireType\(([^),]+)\)/g, 'this.wireType($1, ast)');
// for some nested ones like (type as any).elementType
c = c.replace(/this\.wireType\(\(type as any\)\.elementType\)/g, 'this.wireType((type as any).elementType, ast)');
c = c.replace(/this\.wireType\(\(type as any\)\.keyType\)/g, 'this.wireType((type as any).keyType, ast)');
c = c.replace(/this\.wireType\(\(type as any\)\.valueType\)/g, 'this.wireType((type as any).valueType, ast)');

// Write back
fs.writeFileSync(file, c, 'utf8');
console.log('ElixirGenerator updated successfully via script');
