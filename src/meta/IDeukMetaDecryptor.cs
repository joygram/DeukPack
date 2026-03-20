/**
 * DeukPack Meta – 파일 단위 복호화 계약.
 * meta_packed 디렉터리에서 파일 단위로 저장된 데이터 로드 시 사용.
 */
namespace DeukPack.Meta
{
	/// <summary>로드 시 파일 단위 복호화</summary>
	public interface IDeukMetaDecryptor
	{
		byte[] Decrypt(byte[] encrypted);
	}

	/// <summary>팩 시 파일 단위 암호화 (선택)</summary>
	public interface IDeukMetaEncryptor
	{
		byte[] Encrypt(byte[] raw);
	}
}
