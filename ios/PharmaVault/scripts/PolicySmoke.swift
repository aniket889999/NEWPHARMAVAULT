import Foundation

// Independent executable for Command Line Tools hosts whose SwiftPM manifest
// runtime is unavailable/mismatched. Exercises the same production policy file.
@main
struct PolicySmoke {
    enum Failure: Error { case assertion(String) }
    static func require(_ condition: Bool, _ label: String) throws {
        if !condition { throw Failure.assertion(label) }
    }
    static func rejects(_ work: () throws -> Void) -> Bool {
        do { try work(); return false } catch { return true }
    }

    static func main() throws {
        try require(try ClientPolicy.endpoint(" https://example.org/api/ ").absoluteString == "https://example.org/api", "normalized endpoint")
        for value in ["", "http://example.org/api", "https://api.pharmavault.invalid/api", "https://user:password@example.org/api", "https://example.org/api?key=secret", "https://example.org/api#token", "https://example.org", "https://example.org/api/../api", "https://example.org/%61pi", "file:///api", "https://example.org:0/api", "https://example.org:65536/api"] {
            try require(rejects { _ = try ClientPolicy.endpoint(value) }, "unsafe endpoint rejected")
        }
        try ClientPolicy.requireSinglePage(1)
        for count in [0, 2, 200] { try require(rejects { try ClientPolicy.requireSinglePage(count) }, "invalid page count rejected") }
        try require(try ClientPolicy.documentPath(caseID: "507f1f77bcf86cd799439011") == "v1/cases/507f1f77bcf86cd799439011/documents", "valid case ID")
        for value in ["../users", "case/other", "", "507f1f77bcf86cd79943901z"] {
            try require(rejects { _ = try ClientPolicy.documentPath(caseID: value) }, "invalid case ID rejected")
        }
        try require(!ClientPolicy.canProcess(uploadedTypes: ["PRESCRIPTION"]), "missing document gate")
        try require(ClientPolicy.canProcess(uploadedTypes: ["PRESCRIPTION", "PHARMACY_INVOICE", "CLAIM_FORM"]), "complete document gate")
        let base = try ClientPolicy.endpoint("https://example.org/api")
        let request = ClientPolicy.request(baseURL: base, path: "v1/cases", method: "POST", token: "synthetic-token", body: Data("synthetic-body".utf8))
        try require(request.url?.absoluteString == "https://example.org/api/v1/cases" && request.value(forHTTPHeaderField: "Authorization") == "Bearer synthetic-token" && request.httpMethod == "POST" && request.httpBody == Data("synthetic-body".utf8), "authenticated request")
        try require(ClientPolicy.request(baseURL: base, path: "users/login", method: "POST", token: nil, body: nil).value(forHTTPHeaderField: "Authorization") == nil, "login has no bearer")
        try require(ClientPolicy.canRestoreSession(savedEndpoint: "https://example.org/api", currentEndpoint: "https://example.org/api") && !ClientPolicy.canRestoreSession(savedEndpoint: "https://old.example.org/api", currentEndpoint: "https://new.example.org/api") && !ClientPolicy.canRestoreSession(savedEndpoint: nil, currentEndpoint: "https://example.org/api"), "environment-bound session")
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let task = session.dataTask(with: base)
        let response = HTTPURLResponse(url: base, statusCode: 307, httpVersion: nil, headerFields: nil)!
        var redirectWasBlocked = false
        NoRedirectDelegate().urlSession(session, task: task, willPerformHTTPRedirection: response, newRequest: URLRequest(url: URL(string: "https://other.example.org/api")!)) { redirected in redirectWasBlocked = redirected == nil }
        try require(redirectWasBlocked, "redirect denied")
        print("U4 pure client policy smoke: 9/9 groups passed; no iOS runtime, camera, Keychain or network exercised.")
    }
}
