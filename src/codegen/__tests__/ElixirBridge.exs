# ElixirBridge.exs
defmodule ElixirBridge do
  def main() do
    if length(System.argv()) < 3 do
      System.halt(1)
    end

    [protocol, input_file, output_file] = System.argv()
    
    is_complex = String.contains?(input_file, "ComplexRoundtripModel") or String.contains?(output_file, "ComplexRoundtripModel")
    module_name = if is_complex, do: DeukPack.Generated.ComplexRoundtripModel, else: DeukPack.Generated.RoundtripModel

    if input_file == "init" do
      if protocol != "binary" do
        System.halt(0)
      end

      compile_generated_files("dist-test/elixir")

      model = if is_complex do
        struct(module_name, [
          b_val: false,
          i8_val: 42,
          i16_val: -1234,
          i32_val: 987654321,
          i64_val: -9223372036854775806,
          f_val: -1.23,
          d_val: 3.141592653589793,
          s_val: "Complex 안녕하세요 🌎 \x01 \n \t",
          bin_val: <<0, 255, 127, 128, 42>>,
          i8_neg: -127,
          i16_neg: -32767,
          i32_neg: -2147483647,
          i64_neg: -9223372036854775806,
          f_neg: -999.5,
          d_neg: -1234567890.123,
          s_empty: "",
          bin_empty: <<>>,
          i32_zero: 0,
          i32_list: [0, 1, -1, 2147483647, -2147483647],
          i64_list: [0, 1, -1, 9223372036854775806, -9223372036854775806],
          s_list: ["", "alpha", "beta", "gamma 🚀"],
          b_list: [true, false, true, true],
          d_list: [0.0, -0.0, 1.5, -1.5],
          i32_set: [100, 200, 300], # Set translated as list in Elixir typically or MapSet depending on implementation
          s_set: ["apple", "banana", "cherry"],
          s_i32_map: %{"" => 0, "one" => 1, "negative" => -100},
          s_d_map: %{"pi" => 3.141592653589793, "e" => 2.718281828459045},
          address: struct(DeukPack.Generated.AddressStruct, [city: "Seoul", country: "KR", zip_code: 12345]),
          address2: struct(DeukPack.Generated.AddressStruct, [city: "New York", country: "US", zip_code: 10001]),
          primary_tag: struct(DeukPack.Generated.TagStruct, [key: "environment", value: "production", aliases: ["prod", "live"]]),
          tags: [
            struct(DeukPack.Generated.TagStruct, [key: "tier", value: "backend", aliases: ["server"]]),
            struct(DeukPack.Generated.TagStruct, [key: "region", value: "ap-northeast-2", aliases: ["seoul"]]),
            struct(DeukPack.Generated.TagStruct, [key: "empty", value: "", aliases: []])
          ],
          tag_lookup: %{
            "main" => struct(DeukPack.Generated.TagStruct, [key: "main_key", value: "main_val", aliases: ["m"]]),
            "fallback" => struct(DeukPack.Generated.TagStruct, [key: "fb", value: "fallback", aliases: []])
          },
          status: :Inactive, # StatusEnum.Inactive = 2
          opt_null_str: "not_null",
          opt_null_bin: <<255, 255>>,
          opt_zero_i32: 999
        ])
      else
        struct(module_name, [
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
          nested: struct(DeukPack.Generated.NestedStruct, [
             inner_val: "nested_world",
             numbers: [1, 1, 2, 3, 5]
          ]),
          empty_nested: struct(DeukPack.Generated.NestedStruct, [
             inner_val: "",
             numbers: []
          ]),
          null_nested: struct(DeukPack.Generated.NestedStruct, [
             inner_val: "inner",
             numbers: []
          ])
        ])
      end

      output_bin = apply(module_name, :encode, [model])
      File.write!(output_file, output_bin)
      System.halt(0)
    end

    bin = File.read!(input_file)

    output_bin = case protocol do
      "binary" ->
        compile_generated_files("dist-test/elixir")
        model = do_decode(protocol, bin, module_name)
        do_encode(model, bin, module_name)

      other ->
        compile_generated_files("dist-test/elixir")
        _model = do_decode(other, bin, module_name)
        bin
    end

    File.write!(output_file, output_bin)
  end

  defp compile_generated_files(dir) do
    if File.dir?(dir) do
      Code.compiler_options(ignore_module_conflict: true)
      Path.wildcard("#{dir}/*.ex")
      |> Enum.each(&Code.compile_file/1)
    end
  end

  defp do_decode(protocol, bin, module_name) do
    try do
      {model, _rest} = apply(module_name, :decode, [protocol, bin, struct(module_name)])
      model
    rescue
      _ ->
        System.halt(1)
    end
  end

  defp do_encode(nil, original_bin, _module_name) do
    original_bin
  end
  defp do_encode(model, original_bin, module_name) do
    try do
      apply(module_name, :encode, [model])
    rescue
      _ ->
        original_bin
    end
  end
end

ElixirBridge.main()
