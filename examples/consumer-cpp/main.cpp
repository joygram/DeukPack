#include "sample_types.h"
#include <iostream>

int main() {
    tutorial::DemoUser u{};
    u.id = 1;
    u.name = "sample";
    u.home.x = 10;
    u.home.y = 20;
    std::cout << "tutorial::DemoUser id=" << u.id << " name=" << u.name << '\n';
    return 0;
}
