using System;

// Run from repo root: examples/scripts/gen-sample.sh then dotnet run --project examples/consumer-csharp
var u = new tutorial.DemoUser
{
    Id = 1,
    Name = "sample",
    Home = new tutorial.DemoPoint { X = 10, Y = 20 }
};
Console.WriteLine($"tutorial.DemoUser Id={u.Id} Name={u.Name} home=({u.Home.X},{u.Home.Y})");
