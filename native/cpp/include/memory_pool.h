/**
 * DeukPack Memory Pool - Arena Allocator for Zero-Alloc Optimization
 * High-performance memory pooling for wire serialization
 *
 * Features:
 * - Fixed-size arena (pre-allocated on construction)
 * - O(1) allocate/deallocate (no fragmentation)
 * - Reset between roundtrips (recyclable)
 * - Thread-safe via thread-local or external synchronization
 *
 * Usage:
 *   ArenaAllocator arena(65536);  // 64KB arena
 *   uint8_t* buf = (uint8_t*)arena.allocate(256);
 *   // ... use buffer ...
 *   arena.reset();  // Reset for next roundtrip
 */

#ifndef DEUKPACK_MEMORY_POOL_H
#define DEUKPACK_MEMORY_POOL_H

#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <vector>

namespace deukpack
{

    /**
     * ArenaAllocator: Linear allocation arena with reset semantics.
     * Suitable for temporary allocations within a single transaction/roundtrip.
     */
    class ArenaAllocator
    {
    public:
        /**
         * Constructor with capacity (bytes).
         * Default: 65536 (64KB) suitable for typical wire messages.
         */
        explicit ArenaAllocator(size_t capacity = 65536)
            : capacity_(capacity), position_(0)
        {
            arena_.resize(capacity);
        }

        /**
         * Allocate 'size' bytes from arena.
         * Throws std::bad_alloc if exhausted.
         */
        inline void *allocate(size_t size)
        {
            if (size == 0)
                return nullptr;

            if (position_ + size > capacity_)
            {
                // Exhausted: throw exception instead of silent failure
                throw std::bad_alloc();
            }

            void *ptr = &arena_[position_];
            position_ += size;
            return ptr;
        }

        /**
         * Deallocate is a no-op in arena allocator.
         * Individual deallocations not supported; use reset() for batch cleanup.
         */
        inline void deallocate(void *ptr)
        {
            (void)ptr; // Unused in arena allocator
        }

        /**
         * Reset arena to initial state.
         * Call this between roundtrips to recycle memory.
         */
        inline void reset()
        {
            position_ = 0;
        }

        /**
         * Current usage in bytes.
         */
        inline size_t usage() const
        {
            return position_;
        }

        /**
         * Remaining capacity in bytes.
         */
        inline size_t remaining() const
        {
            return capacity_ - position_;
        }

        /**
         * Is arena exhausted?
         */
        inline bool is_exhausted() const
        {
            return position_ >= capacity_;
        }

        /**
         * Total capacity in bytes.
         */
        inline size_t capacity() const
        {
            return capacity_;
        }

    private:
        std::vector<uint8_t> arena_;
        size_t capacity_;
        size_t position_;
    };

    /**
     * StackAllocator: Fixed-size stack-based allocation.
     * For compile-time known maximum sizes (e.g., small messages <4KB).
     *
     * Template parameter SIZE: maximum allocation size in bytes.
     * Example: StackAllocator<4096> for 4KB messages.
     */
    template <size_t SIZE = 4096>
    class StackAllocator
    {
    public:
        StackAllocator() : position_(0) {}

        inline void *allocate(size_t size)
        {
            if (size == 0)
                return nullptr;

            if (position_ + size > SIZE)
            {
                throw std::bad_alloc();
            }

            void *ptr = &stack_[position_];
            position_ += size;
            return ptr;
        }

        inline void deallocate(void *ptr)
        {
            (void)ptr;
        }

        inline void reset()
        {
            position_ = 0;
        }

        inline size_t usage() const
        {
            return position_;
        }

        inline size_t remaining() const
        {
            return SIZE - position_;
        }

    private:
        uint8_t stack_[SIZE];
        size_t position_;
    };

} // namespace deukpack

#endif // DEUKPACK_MEMORY_POOL_H
