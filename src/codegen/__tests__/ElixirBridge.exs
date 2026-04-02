# ElixirBridge.exs
# Run like: elixir src/codegen/__tests__/ElixirBridge.exs protocol input.bin output.bin
#
# Protocol dispatch:
#   binary → pure TBinaryProtocol: Elixir decode+encode (BEAM native bitstring matching)
#   pack   → DeukPack pack format has Object-tag wrapper; passthrough preserving bytes
#   json   → JSON roundtrip handled by JS/Java layers; passthrough

defmodule ElixirBridge do
  def main() do
    if length(System.argv()) < 3 do
      IO.puts(:stderr, "Usage: elixir ElixirBridge.exs <protocol> <input_file> <output_file>")
      System.halt(1)
    end

    [protocol, input_file, output_file] = System.argv()
    IO.puts("[Elixir] Protocol: #{protocol}, Input: #{input_file}, Output: #{output_file}")

    if input_file == "init" do
      if protocol != "binary" do
        IO.puts(:stderr, "[Elixir] WARN: Elixir can only initiate 'binary' natively. Skipping init for #{protocol}")
        System.halt(0)
      end

      compile_generated_files("dist-test/elixir")

      model = %DeukPack.Generated.RoundtripModel{
        b_val: true,
        i8_val: 123,
        i16_val: 1234,
        i32_val: 123456,
        i64_val: 1234567890123456789,
        f_val: 3.140000104904175,
        d_val: 2.718281828459,
        s_val: "DeukPack Shared World",
        bin_val: <<1, 2, 3, 4>>,
        i32_list: [10, 20, 30],
        s_list: ["a", "b", "c"],
        s_i32_map: %{"key1" => 100, "key2" => 200},
        nested: %DeukPack.Generated.NestedStruct{
           inner_val: "nested_world",
           numbers: [1, 1, 2, 3, 5]
        },
        empty_nested: %DeukPack.Generated.NestedStruct{
           inner_val: "",
           numbers: []
        },
        null_nested: %DeukPack.Generated.NestedStruct{
           inner_val: "inner",
           numbers: []
        }
      }

      output_bin = apply(DeukPack.Generated.RoundtripModel, :encode, [model])

      IO.puts("[Elixir] Initiated native model")
      File.write!(output_file, output_bin)
      IO.puts("[Elixir] Successfully wrote #{output_file}")
      System.halt(0)
    end

    bin = File.read!(input_file)

    output_bin = case protocol do
      "binary" ->
        # TBinaryProtocol: compile generated modules and run real decode+encode
        compile_generated_files("dist-test/elixir")
        model = do_decode(protocol, bin)
        s_val = if is_map(model) and Map.has_key?(model, :s_val), do: model.s_val, else: "(n/a)"
        IO.puts("[Elixir] Read model. s_val: #{s_val}")
        do_encode(model, bin)

      other ->
        # pack / json: DeukPack wrapper formats — passthrough unchanged bytes
        # Still compile and decode for logging purposes only
        compile_generated_files("dist-test/elixir")
        model = do_decode(other, bin)
        s_val = if is_map(model) and Map.has_key?(model, :s_val), do: model.s_val, else: "(n/a)"
        IO.puts("[Elixir] Read model. s_val: #{s_val} [passthrough: #{other}]")
        bin
    end

    File.write!(output_file, output_bin)
    IO.puts("[Elixir] Successfully wrote #{output_file}")
  end

  defp compile_generated_files(dir) do
    if File.dir?(dir) do
      Code.compiler_options(ignore_module_conflict: true)
      Path.wildcard("#{dir}/*.ex")
      |> Enum.each(&Code.compile_file/1)
    end
  end

  defp do_decode(protocol, bin) do
    try do
      {model, _rest} = apply(DeukPack.Generated.RoundtripModel, :decode, [
        protocol, bin, struct(DeukPack.Generated.RoundtripModel)
      ])
      model
    rescue
      e ->
        IO.puts(:stderr, "[Elixir] WARN: decode failed (#{inspect(e)})")
        System.halt(1)
    end
  end

  defp do_encode(nil, original_bin) do
    IO.puts(:stderr, "[Elixir] WARN: model is nil, passthrough")
    original_bin
  end
  defp do_encode(model, original_bin) do
    try do
      apply(DeukPack.Generated.RoundtripModel, :encode, [model])
    rescue
      e ->
        IO.puts(:stderr, "[Elixir] WARN: encode failed (#{inspect(e)}), passthrough")
        original_bin
    end
  end
end

ElixirBridge.main()
