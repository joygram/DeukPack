//게임 로직 시스템에 공유하는 상수, 구조체를 선언하는 곳
include "gplat_define.thrift"

namespace * meta_define

typedef string _mnote	
typedef i64 _linktid_stage_char				
typedef i64 _linktid_story_char
typedef i64 _linktid_story_faceani
typedef i64 _linktid_story_bg


// 테이블 구조체
struct locale_string
{
	//영어
	4:string en = "";

	//일본어
	3:string jp = "";
