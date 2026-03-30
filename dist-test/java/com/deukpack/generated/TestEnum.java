package com.deukpack.generated;

/**
 * Generated Enum: TestEnum
 * @generated
 */
public enum TestEnum {
    Alpha(1),
    Beta(2),
    Gamma(3);

    public final int value;
    TestEnum(int v) { this.value = v; }
    public int getValue() { return value; }
    public static TestEnum findByValue(int v) {
        for (TestEnum t : TestEnum.values()) if (t.value == v) return t;
        return null;
    }
}
