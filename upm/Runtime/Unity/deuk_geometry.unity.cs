/**
 * Unity implicit operators for deuk geometry types.
 * Paired with deuk_geometry.impl.cs (pure math) and generated deuk_geometry_deuk.cs (layout).
 */

#if UNITY_5_3_OR_NEWER
namespace deuk
{
  public partial struct Vector2
  {
    public static implicit operator global::UnityEngine.Vector2(Vector2 v) => new global::UnityEngine.Vector2(v.x, v.y);
    public static implicit operator Vector2(global::UnityEngine.Vector2 v) => new Vector2(v.x, v.y);
  }

  public partial struct Vector3
  {
    public static implicit operator global::UnityEngine.Vector3(Vector3 v) =>
      new global::UnityEngine.Vector3(v.x, v.y, v.z);
    public static implicit operator Vector3(global::UnityEngine.Vector3 v) => new Vector3(v.x, v.y, v.z);
  }

  public partial struct Vector4
  {
    public static implicit operator global::UnityEngine.Vector4(Vector4 v) =>
      new global::UnityEngine.Vector4(v.x, v.y, v.z, v.w);
    public static implicit operator Vector4(global::UnityEngine.Vector4 v) =>
      new Vector4(v.x, v.y, v.z, v.w);
  }

  public partial struct Position
  {
    public static implicit operator global::UnityEngine.Vector3(Position p) =>
      new global::UnityEngine.Vector3(p.x, p.y, p.z);
  }

  public partial struct Quaternion
  {
    public static implicit operator global::UnityEngine.Quaternion(Quaternion q) =>
      new global::UnityEngine.Quaternion(q.x, q.y, q.z, q.w);
    public static implicit operator Quaternion(global::UnityEngine.Quaternion q) =>
      new Quaternion(q.x, q.y, q.z, q.w);
  }

  public partial struct Matrix4x4
  {
    public static implicit operator global::UnityEngine.Matrix4x4(Matrix4x4 d)
    {
      global::UnityEngine.Matrix4x4 u = default;
      u.m00 = d.m00;
      u.m01 = d.m01;
      u.m02 = d.m02;
      u.m03 = d.m03;
      u.m10 = d.m10;
      u.m11 = d.m11;
      u.m12 = d.m12;
      u.m13 = d.m13;
      u.m20 = d.m20;
      u.m21 = d.m21;
      u.m22 = d.m22;
      u.m23 = d.m23;
      u.m30 = d.m30;
      u.m31 = d.m31;
      u.m32 = d.m32;
      u.m33 = d.m33;
      return u;
    }

    public static implicit operator Matrix4x4(global::UnityEngine.Matrix4x4 u) =>
      new Matrix4x4(
        u.m00, u.m01, u.m02, u.m03,
        u.m10, u.m11, u.m12, u.m13,
        u.m20, u.m21, u.m22, u.m23,
        u.m30, u.m31, u.m32, u.m33);
  }
}
#endif
