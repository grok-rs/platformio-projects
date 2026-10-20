#pragma once

#include <cstddef>

// Мінімальний аналог std::span<const T> (з'явився лише у C++20):
// невласний «погляд» лише для читання на масив — вказівник + довжина.
template <typename T>
class Span {
 public:
  template <size_t N>
  constexpr Span(T (&array)[N]) : data_(array), size_(N) {}   // NOLINT: неявна конверсія з масиву — навмисно
  constexpr Span(const T* data, size_t size) : data_(data), size_(size) {}

  constexpr const T* begin() const { return data_; }
  constexpr const T* end() const { return data_ + size_; }
  constexpr size_t size() const { return size_; }
  constexpr bool   empty() const { return size_ == 0; }
  constexpr const T& operator[](size_t index) const { return data_[index]; }

 private:
  const T* data_;
  size_t   size_;
};
