package com.nexus.cruncher;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * Cruncher — a small, dependency-free Java microservice.
 *
 * Built on the JDK's built-in com.sun.net.httpserver instead of a framework
 * like Spring Boot, on purpose: it compiles and runs with nothing but a JDK
 * (javac + java), no Maven/Gradle dependency resolution required. That makes
 * it trivially portable and fast to boot — a deliberate architectural choice
 * for a small internal "number crunching" service sitting behind a gateway,
 * not a limitation.
 *
 * Endpoints:
 *   GET /health
 *   GET /primes?limit=N              -> primes up to N (Sieve of Eratosthenes)
 *   GET /collatz?start=N             -> Collatz sequence from N to 1
 *   GET /textanalysis?text=...       -> word count, palindrome check, char frequency
 */
public class CruncherServer {

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8081"));

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newFixedThreadPool(8));

        server.createContext("/health", withCors(CruncherServer::handleHealth));
        server.createContext("/primes", withCors(CruncherServer::handlePrimes));
        server.createContext("/collatz", withCors(CruncherServer::handleCollatz));
        server.createContext("/textanalysis", withCors(CruncherServer::handleTextAnalysis));

        server.start();
        System.out.println("Cruncher (Java) listening on :" + port);
    }

    // ---- Handlers ----

    private static void handleHealth(HttpExchange ex) throws IOException {
        writeJson(ex, 200, "{\"status\":\"ok\",\"service\":\"cruncher-java\"}");
    }

    private static void handlePrimes(HttpExchange ex) throws IOException {
        Map<String, String> params = parseQuery(ex.getRequestURI().getRawQuery());
        int limit;
        try {
            limit = Math.min(Integer.parseInt(params.getOrDefault("limit", "100")), 1_000_000);
        } catch (NumberFormatException e) {
            writeJson(ex, 400, "{\"error\":\"limit must be an integer\"}");
            return;
        }
        if (limit < 2) {
            writeJson(ex, 200, "{\"limit\":" + limit + ",\"count\":0,\"primes\":[]}");
            return;
        }

        long start = System.nanoTime();
        boolean[] sieve = new boolean[limit + 1];
        java.util.Arrays.fill(sieve, true);
        sieve[0] = false;
        sieve[1] = false;
        for (int i = 2; (long) i * i <= limit; i++) {
            if (sieve[i]) {
                for (int j = i * i; j <= limit; j += i) sieve[j] = false;
            }
        }
        StringBuilder primes = new StringBuilder();
        int count = 0;
        for (int i = 2; i <= limit; i++) {
            if (sieve[i]) {
                if (count > 0) primes.append(",");
                primes.append(i);
                count++;
            }
        }
        double ms = (System.nanoTime() - start) / 1_000_000.0;

        String json = String.format(
            "{\"limit\":%d,\"count\":%d,\"computeTimeMs\":%.3f,\"primes\":[%s]}",
            limit, count, ms, primes
        );
        writeJson(ex, 200, json);
    }

    private static void handleCollatz(HttpExchange ex) throws IOException {
        Map<String, String> params = parseQuery(ex.getRequestURI().getRawQuery());
        long n;
        try {
            n = Long.parseLong(params.getOrDefault("start", "27"));
        } catch (NumberFormatException e) {
            writeJson(ex, 400, "{\"error\":\"start must be an integer\"}");
            return;
        }
        if (n < 1) {
            writeJson(ex, 400, "{\"error\":\"start must be >= 1\"}");
            return;
        }

        StringBuilder seq = new StringBuilder();
        long current = n;
        int steps = 0;
        seq.append(current);
        while (current != 1 && steps < 100_000) {
            current = (current % 2 == 0) ? current / 2 : 3 * current + 1;
            seq.append(",").append(current);
            steps++;
        }

        String json = String.format(
            "{\"start\":%d,\"steps\":%d,\"sequence\":[%s]}",
            n, steps, seq
        );
        writeJson(ex, 200, json);
    }

    private static void handleTextAnalysis(HttpExchange ex) throws IOException {
        Map<String, String> params = parseQuery(ex.getRequestURI().getRawQuery());
        String text = params.getOrDefault("text", "");
        String normalized = text.toLowerCase().replaceAll("[^a-z0-9]", "");

        boolean isPalindrome = !normalized.isEmpty() &&
            normalized.equals(new StringBuilder(normalized).reverse().toString());

        String[] words = text.trim().isEmpty() ? new String[0] : text.trim().split("\\s+");

        Map<Character, Integer> freq = new HashMap<>();
        for (char c : normalized.toCharArray()) {
            freq.merge(c, 1, Integer::sum);
        }
        char mostCommon = 0;
        int maxCount = 0;
        for (Map.Entry<Character, Integer> e : freq.entrySet()) {
            if (e.getValue() > maxCount) {
                maxCount = e.getValue();
                mostCommon = e.getKey();
            }
        }

        String json = String.format(
            "{\"wordCount\":%d,\"charCount\":%d,\"isPalindrome\":%s,\"mostCommonChar\":\"%s\",\"mostCommonCount\":%d}",
            words.length,
            text.length(),
            isPalindrome,
            mostCommon == 0 ? "" : String.valueOf(mostCommon),
            maxCount
        );
        writeJson(ex, 200, json);
    }

    // ---- Helpers ----

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> result = new HashMap<>();
        if (raw == null || raw.isEmpty()) return result;
        for (String pair : raw.split("&")) {
            int idx = pair.indexOf('=');
            if (idx < 0) continue;
            String key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
            String value = URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
            result.put(key, value);
        }
        return result;
    }

    private static void writeJson(HttpExchange ex, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static HttpHandler withCors(HttpHandler inner) {
        return ex -> {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");
            if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) {
                ex.sendResponseHeaders(204, -1);
                return;
            }
            inner.handle(ex);
        };
    }
}
