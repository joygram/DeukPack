using System;
using System.IO;
using DeukPack.Protocol;

namespace TutorialSample
{
    class Program
    {
#if !NETSTANDARD2_0
        static void Main()
        {
            // 1) Basic DemoUser
            var u = new tutorial.DemoUser
            {
                Id = 1,
                Name = "sample",
                Home = new tutorial.DemoPoint { X = 10, Y = 20 }
            };
            Console.WriteLine($"[DemoUser] Id={u.Id} Name={u.Name} home=({u.Home.X},{u.Home.Y})");

            // 2) Round-trip Write/Read (binary)
            using (var ms = new MemoryStream())
            {
                var oprot = DeukPackSerializer.OpenBinaryPack(ms);
                u.Write(oprot);
                oprot.Dispose();
                ms.Position = 0;
                var iprot = DeukPackSerializer.OpenBinaryUnpack(ms);
                var u2 = new tutorial.DemoUser();
                u2.Read(iprot);
                Console.WriteLine($"[Round-trip Binary] Id={u2.Id} Name={u2.Name}");
            }

            // 3) UserRecord
            var record = new tutorial.UserRecord
            {
                Id = 10,
                DisplayName = "Bob",
                Level = 5,
                AvatarUrl = "https://example.com/avatar.png"
            };
            Console.WriteLine($"[UserRecord] Id={record.Id} DisplayName={record.DisplayName} Level={record.Level}");

            // 4) extends: UserFull
            var fullUser = new tutorial.UserFull { Id = 1, Tag = "dev", Level = 42 };
            Console.WriteLine($"[extends UserFull] Id={fullUser.Id} Tag={fullUser.Tag} Level={fullUser.Level}");

            Console.WriteLine("OK");
        }
#endif
    }
}
