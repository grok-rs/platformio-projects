# Одна прошивка на завдання: тека збирання .pio/build/<env> дає ім'я файлу src/<env>.c
get_filename_component(STAGE ${CMAKE_BINARY_DIR} NAME)
idf_component_register(SRCS "${STAGE}.c" REQUIRES esp_driver_gpio esp_timer)
