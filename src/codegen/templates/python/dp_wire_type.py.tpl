# DeukPack Wire Types (Thrift TBinaryProtocol compatible)

class DpWireType:
    STOP    = 0
    VOID    = 1
    BOOL    = 2
    BYTE    = 3
    DOUBLE  = 4
    INT32   = 8
    INT16   = 6
    INT64   = 10
    STRING  = 11
    STRUCT  = 12
    MAP     = 13
    SET     = 14
    LIST    = 15
    # DeukPack Extensions
    ENUM    = 8
    BINARY  = 11
    RECORD  = 12
