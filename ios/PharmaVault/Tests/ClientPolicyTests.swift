import XCTest
@testable import PharmaVaultClientPolicy

final class ClientPolicyTests: XCTestCase {
    func testNormalizesHTTPSBackend() throws {
        XCTAssertEqual(try ClientPolicy.endpoint(" https://example.org/api/ ").absoluteString, "https://example.org/api")
        XCTAssertEqual(try ClientPolicy.endpoint("https://example.org/service/api").path, "/service/api")
    }

    func testRejectsUnsafeAndPlaceholderEndpoints() {
        for value in ["", "http://example.org/api", "https://api.pharmavault.invalid/api", "https://user:password@example.org/api", "https://example.org/api?key=secret", "https://example.org/api#token", "https://example.org", "https://example.org/api/../api", "https://example.org/%61pi", "file:///api", "https://example.org:0/api", "https://example.org:65536/api"] {
            XCTAssertThrowsError(try ClientPolicy.endpoint(value), value)
        }
    }

    func testOnePageOnlyNeverSilentlyTruncates() throws {
        try ClientPolicy.requireSinglePage(1)
        XCTAssertThrowsError(try ClientPolicy.requireSinglePage(0))
        XCTAssertThrowsError(try ClientPolicy.requireSinglePage(2))
        XCTAssertThrowsError(try ClientPolicy.requireSinglePage(200))
    }

    func testCaseIDsCannotInjectPaths() throws {
        XCTAssertEqual(try ClientPolicy.documentPath(caseID: "507f1f77bcf86cd799439011"), "v1/cases/507f1f77bcf86cd799439011/documents")
        for value in ["../users", "case/other", "", "507f1f77bcf86cd79943901z"] {
            XCTAssertThrowsError(try ClientPolicy.documentPath(caseID: value))
        }
    }

    func testProcessingRequiresAllThreeDocumentTypes() {
        XCTAssertFalse(ClientPolicy.canProcess(uploadedTypes: []))
        XCTAssertFalse(ClientPolicy.canProcess(uploadedTypes: ["PRESCRIPTION", "PHARMACY_INVOICE"]))
        XCTAssertTrue(ClientPolicy.canProcess(uploadedTypes: ["PRESCRIPTION", "PHARMACY_INVOICE", "CLAIM_FORM"]))
    }

    func testAuthenticatedRequestUsesExactConfiguredBackend() throws {
        let base = try ClientPolicy.endpoint("https://example.org/api")
        let body = Data("synthetic-upload".utf8)
        let request = ClientPolicy.request(baseURL: base, path: try ClientPolicy.documentPath(caseID: "507f1f77bcf86cd799439011"), method: "POST", token: "test-only-token", body: body)
        XCTAssertEqual(request.url?.absoluteString, "https://example.org/api/v1/cases/507f1f77bcf86cd799439011/documents")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-only-token")
        XCTAssertEqual(request.httpBody, body)
        XCTAssertEqual(request.httpMethod, "POST")
    }

    func testLoginRequestContainsNoBearerHeader() throws {
        let request = ClientPolicy.request(baseURL: try ClientPolicy.endpoint("https://example.org/api"), path: "users/login", method: "POST", token: nil, body: nil)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func testSavedTokenCannotMoveBetweenEnvironments() {
        XCTAssertTrue(ClientPolicy.canRestoreSession(savedEndpoint: "https://example.org/api", currentEndpoint: "https://example.org/api"))
        XCTAssertFalse(ClientPolicy.canRestoreSession(savedEndpoint: "https://old.example.org/api", currentEndpoint: "https://new.example.org/api"))
        XCTAssertFalse(ClientPolicy.canRestoreSession(savedEndpoint: nil, currentEndpoint: "https://example.org/api"))
        XCTAssertFalse(ClientPolicy.canRestoreSession(savedEndpoint: "https://example.org/api", currentEndpoint: ""))
    }

    func testRedirectNeverForwardsRequest() throws {
        let source = try ClientPolicy.endpoint("https://example.org/api")
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let task = session.dataTask(with: source)
        let response = HTTPURLResponse(url: source, statusCode: 307, httpVersion: nil, headerFields: ["Location": "https://other.example.org/api"])!
        var invoked = false
        NoRedirectDelegate().urlSession(session, task: task, willPerformHTTPRedirection: response, newRequest: URLRequest(url: URL(string: "https://other.example.org/api")!)) { redirectedRequest in
            invoked = true
            XCTAssertNil(redirectedRequest)
        }
        XCTAssertTrue(invoked)
    }
}
