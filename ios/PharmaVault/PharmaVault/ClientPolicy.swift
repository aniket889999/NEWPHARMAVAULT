import Foundation

// Shared with the macOS-runnable policy tests. No camera, credentials or network
// calls are needed to exercise these boundaries.
enum ClientPolicyError: LocalizedError {
    case invalidEndpoint, unconfigured, invalidCaseID, invalidPageCount, multiplePages

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "Use a complete HTTPS backend URL ending in /api, without credentials, query parameters or a placeholder host."
        case .unconfigured: return "Configure your HTTPS backend before signing in."
        case .invalidCaseID: return "The server returned an invalid case reference."
        case .invalidPageCount: return "No page was captured. Scan one clear page."
        case .multiplePages: return "This mobile MVP accepts exactly one page per document type. Nothing was selected or uploaded. Rescan one page; use the web workflow for multi-page PDFs."
        }
    }
}

enum ClientPolicy {
    static let maximumUploadBytes = 5 * 1024 * 1024

    static func endpoint(_ input: String) throws -> URL {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { throw ClientPolicyError.unconfigured }
        guard !value.contains("\\"),
              let parts = URLComponents(string: value),
              parts.scheme?.lowercased() == "https",
              let host = parts.host, !host.isEmpty,
              !host.lowercased().hasSuffix(".invalid"),
              parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil,
              parts.port == nil || (1...65535).contains(parts.port!),
              !parts.percentEncodedPath.contains("%"),
              !parts.path.split(separator: "/").contains(where: { $0 == "." || $0 == ".." }),
              let url = parts.url else { throw ClientPolicyError.invalidEndpoint }
        let path = parts.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard path == "api" || path.hasSuffix("/api") else { throw ClientPolicyError.invalidEndpoint }
        return URL(string: url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")))!
    }

    static func documentPath(caseID: String) throws -> String {
        guard caseID.range(of: "^[a-fA-F0-9]{24}$", options: .regularExpression) != nil else {
            throw ClientPolicyError.invalidCaseID
        }
        return "v1/cases/\(caseID)/documents"
    }

    static func requireSinglePage(_ count: Int) throws {
        guard count > 0 else { throw ClientPolicyError.invalidPageCount }
        guard count == 1 else { throw ClientPolicyError.multiplePages }
    }

    static func canProcess(uploadedTypes: Set<String>) -> Bool {
        Set(["PRESCRIPTION", "PHARMACY_INVOICE", "CLAIM_FORM"]).isSubset(of: uploadedTypes)
    }

    static func canRestoreSession(savedEndpoint: String?, currentEndpoint: String) -> Bool {
        guard let current = try? endpoint(currentEndpoint), let savedEndpoint,
              let saved = try? endpoint(savedEndpoint) else { return false }
        return current == saved
    }

    static func request(baseURL: URL, path: String, method: String, token: String?, body: Data?) -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = body
        return request
    }
}

// Credential-bearing redirects are never followed, including same-host redirects.
final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
