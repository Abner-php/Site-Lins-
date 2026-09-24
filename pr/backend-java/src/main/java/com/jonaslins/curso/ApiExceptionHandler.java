package com.jonaslins.curso;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
class ApiExceptionHandler {
  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  Map<String, String> invalid(IllegalArgumentException error) { return Map.of("error", error.getMessage()); }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  @ResponseStatus(HttpStatus.PAYLOAD_TOO_LARGE)
  Map<String, String> tooLarge() { return Map.of("error", "O vídeo deve ter no máximo 500 MB."); }
}
