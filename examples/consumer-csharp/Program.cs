using System;
using System.Collections.Generic;
using System.IO;
using DeukPack.Protocol;

// Run from repo root: examples/scripts/gen-sample.sh then dotnet run --project examples/consumer-csharp

// 1) Basic DemoUser
var u = new tutorial.DemoUser
{
    Id = 1,
    Name = "sample",
    Home = new tutorial.DemoPoint { X = 10, Y = 20 }
};
Console.WriteLine($"[DemoUser] Id={u.Id} Name={u.Name} home=({u.Home.X},{u.Home.Y})");

// 2) Round-trip Write/Read
using (var ms = new MemoryStream())
{
    var oprot = DeukPackSerializer.OpenBinaryPack(ms);
    u.Write(oprot);
    oprot.Dispose();
    ms.Position = 0;
    var iprot = DeukPackSerializer.OpenBinaryUnpack(ms);
    var u2 = new tutorial.DemoUser();
    u2.Read(iprot);
    Console.WriteLine($"[Round-trip] Id={u2.Id} Name={u2.Name}");
}

// 3) WriteWithOverrides (fan-out: same instance, different Name per "recipient")
using (var ms = new MemoryStream())
{
    var oprot = DeukPackSerializer.OpenBinaryPack(ms);
    u.WriteWithOverrides(oprot, new Dictionary<int, object>
    {
        { tutorial.DemoUser.FieldId.Name, "Alice" }
    });
    oprot.Dispose();
    ms.Position = 0;
    var iprot = DeukPackSerializer.OpenBinaryUnpack(ms);
    var u3 = new tutorial.DemoUser();
    u3.Read(iprot);
    Console.WriteLine($"[WriteWithOverrides] Name={u3.Name} (expected Alice)");
}

// 4) WriteFields (UserRecord: project subset)
var full = new tutorial.UserRecord
{
    Id = 10,
    DisplayName = "Bob",
    Level = 5,
    AvatarUrl = "https://example.com/avatar.png"
};
using (var ms = new MemoryStream())
{
    var oprot = DeukPackSerializer.OpenBinaryPack(ms);
    full.WriteFields(oprot, new[] {
        tutorial.UserRecord.FieldId.Id,
        tutorial.UserRecord.FieldId.DisplayName,
        tutorial.UserRecord.FieldId.Level
    });
    oprot.Dispose();
    ms.Position = 0;
    var iprot = DeukPackSerializer.OpenBinaryUnpack(ms);
    var partial = new tutorial.UserRecord();
    partial.Read(iprot);
    Console.WriteLine($"[WriteFields] Id={partial.Id} DisplayName={partial.DisplayName} Level={partial.Level} AvatarUrl='{partial.AvatarUrl ?? ""}' (empty)");
}

// 5) extends: UserFull has id, tag (from UserBase) + level
var fullUser = new tutorial.UserFull { Id = 1, Tag = "dev", Level = 42 };
Console.WriteLine($"[extends UserFull] Id={fullUser.Id} Tag={fullUser.Tag} Level={fullUser.Level}");

Console.WriteLine("OK");
