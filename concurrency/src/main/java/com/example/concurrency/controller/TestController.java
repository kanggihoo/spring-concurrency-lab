package com.example.concurrency.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping
    public ResponseEntity<Map<String, String>> simpleTest() throws InterruptedException {
        // 간단한 딜레이를 주어 부하 상황 시뮬레이션 (10ms)
        Thread.sleep(10);
        return ResponseEntity.ok(Map.of("message", "Load test API is working!"));
    }
}
