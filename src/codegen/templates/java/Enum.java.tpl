package @@JAVA_PACKAGE@@;

/**
 * @@DOC_COMMENT@@
 * @generated
 */
public enum @@ENUM_NAME@@ {
@@ENUM_VALUES@@

    public final int value;
    @@ENUM_NAME@@(int v) { this.value = v; }
    public int getValue() { return value; }
    public static @@ENUM_NAME@@ findByValue(int v) {
        for (@@ENUM_NAME@@ t : @@ENUM_NAME@@.values()) if (t.value == v) return t;
        return null;
    }
}
