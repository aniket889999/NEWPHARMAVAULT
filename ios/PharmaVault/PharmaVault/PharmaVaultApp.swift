import SwiftUI
import VisionKit
import Security
import AVFoundation
import UIKit

// MARK: - App entry

@main
struct PharmaVaultApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}

// MARK: - Configuration and privacy-safe storage

enum APIConfiguration {
    private static let baseURLKey = "pharmavault.api.base-url"
    static var baseURLString: String { UserDefaults.standard.string(forKey: baseURLKey) ?? "" }
    static var isConfigured: Bool { (try? ClientPolicy.endpoint(baseURLString)) != nil }
    static func baseURL() throws -> URL { try ClientPolicy.endpoint(baseURLString) }

    static func save(baseURLString: String) throws {
        let url = try ClientPolicy.endpoint(baseURLString)
        UserDefaults.standard.set(url.absoluteString, forKey: baseURLKey)
    }
}

enum KeychainStore {
    private static let service = "edu.mitadt.pharmavault"
    private static let account = "session-token"

    static func save(token: String) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let update: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)

        if status == errSecItemNotFound {
            var insert = query
            insert[kSecValueData as String] = data
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let addStatus = SecItemAdd(insert as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw AppError.keychain(addStatus) }
        } else if status != errSecSuccess {
            throw AppError.keychain(status)
        }
    }

    static func read() throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, let token = String(data: data, encoding: .utf8) else {
            throw AppError.keychain(status)
        }
        return token
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Network models

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case patient, pharmacy, pharmacist, claims_reviewer, org_admin, super_admin
    var id: String { rawValue }
    var label: String {
        switch self {
        case .patient: return "Patient"
        case .pharmacy: return "Pharmacy"
        case .pharmacist: return "Pharmacist"
        case .claims_reviewer: return "Claims reviewer"
        case .org_admin: return "Organisation admin"
        case .super_admin: return "Super admin"
        }
    }
}

struct AuthResponse: Decodable {
    let id: String
    let name: String
    let email: String
    let role: UserRole
    let token: String

    init(id: String, name: String, email: String, role: UserRole, token: String) {
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.token = token
    }

    enum CodingKeys: String, CodingKey { case id, legacyID = "_id", name, email, role, token }
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let publicID = try container.decodeIfPresent(String.self, forKey: .id) {
            id = publicID
        } else {
            id = try container.decode(String.self, forKey: .legacyID)
        }
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = try container.decode(UserRole.self, forKey: .role)
        token = try container.decode(String.self, forKey: .token)
    }
}

struct VerificationCase: Decodable, Identifiable {
    let id: String
    let caseReference: String
    let status: String
    let reviewRequired: Bool
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey { case id, legacyID = "_id", caseReference, status, reviewRequired, updatedAt }
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let publicID = try container.decodeIfPresent(String.self, forKey: .id) {
            id = publicID
        } else {
            id = try container.decode(String.self, forKey: .legacyID)
        }
        caseReference = try container.decode(String.self, forKey: .caseReference)
        status = try container.decode(String.self, forKey: .status)
        reviewRequired = try container.decodeIfPresent(Bool.self, forKey: .reviewRequired) ?? false
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
    }
}

enum DocumentType: String, Codable, CaseIterable, Identifiable {
    case prescription = "PRESCRIPTION"
    case pharmacyInvoice = "PHARMACY_INVOICE"
    case claimForm = "CLAIM_FORM"
    var id: String { rawValue }
    var title: String {
        switch self {
        case .prescription: return "Prescription"
        case .pharmacyInvoice: return "Pharmacy invoice"
        case .claimForm: return "Claim form"
        }
    }
}

struct NewCaseRequest: Encodable {
    let subjectReference: String?
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
    let role: UserRole
}

struct ProfileResponse: Decodable {
    let id: String
    let name: String
    let email: String
    let role: UserRole

    enum CodingKeys: String, CodingKey { case id, legacyID = "_id", name, email, role }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let publicID = try container.decodeIfPresent(String.self, forKey: .id) {
            id = publicID
        } else {
            id = try container.decode(String.self, forKey: .legacyID)
        }
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = try container.decode(UserRole.self, forKey: .role)
    }
}

struct UploadRequest: Encodable {
    let type: DocumentType
    let file: String
    let filename: String
    let mimeType: String
}

struct APIErrorBody: Decodable { let message: String?; let detail: String? }

enum AppError: LocalizedError {
    case configuration(String)
    case keychain(OSStatus)
    case server(String)
    case invalidImage
    case uploadLimit
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .server(let message): return message
        case .keychain: return "The secure session could not be stored on this device."
        case .invalidImage: return "The scanned image could not be prepared for secure upload."
        case .uploadLimit: return "The scanned image exceeds the 5 MB upload limit. Scan one clear page at a time."
        case .unauthorized: return "Your session expired or was revoked. Sign in again."
        }
    }
}

// MARK: - API client

actor PharmaVaultAPI {
    static let shared = PharmaVaultAPI()
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder: JSONDecoder

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        session = URLSession(configuration: configuration, delegate: NoRedirectDelegate(), delegateQueue: nil)
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) { return date }
            throw DecodingError.dataCorruptedError(in: try decoder.singleValueContainer(), debugDescription: "Invalid server timestamp")
        }
    }

    func login(email: String, password: String, role: UserRole) async throws -> AuthResponse {
        try await request(path: "users/login", method: "POST", token: nil, body: LoginRequest(email: email, password: password, role: role))
    }

    func fetchCases(token: String) async throws -> [VerificationCase] {
        try await request(path: "v1/cases", method: "GET", token: token, body: Optional<String>.none)
    }

    func fetchProfile(token: String) async throws -> ProfileResponse {
        try await request(path: "users/profile", method: "GET", token: token, body: Optional<String>.none)
    }

    func createCase(subjectReference: String?, token: String) async throws -> VerificationCase {
        try await request(path: "v1/cases", method: "POST", token: token, body: NewCaseRequest(subjectReference: subjectReference))
    }

    func upload(image: UIImage, type: DocumentType, caseID: String, token: String) async throws {
        guard image.size.width > 0, image.size.height > 0 else { throw AppError.invalidImage }
        let scale = min(1, 2400 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        // Re-render pixels only; do not upload camera file metadata.
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let prepared = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = prepared.jpegData(compressionQuality: 0.82) else { throw AppError.invalidImage }
        guard jpeg.count <= ClientPolicy.maximumUploadBytes else { throw AppError.uploadLimit }
        let dataURI = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        let request = UploadRequest(
            type: type,
            file: dataURI,
            filename: "\(type.rawValue.lowercased())_\(UUID().uuidString).jpg",
            mimeType: "image/jpeg"
        )
        let _: EmptyResponse = try await self.request(path: ClientPolicy.documentPath(caseID: caseID), method: "POST", token: token, body: request)
    }

    func processCase(caseID: String, token: String) async throws -> VerificationCase {
        _ = try ClientPolicy.documentPath(caseID: caseID)
        let _: EmptyResponse = try await request(path: "v1/cases/\(caseID)/process", method: "POST", token: token, body: Optional<String>.none)
        return try await request(path: "v1/cases/\(caseID)", method: "GET", token: token, body: Optional<String>.none)
    }

    private func request<Body: Encodable, Response: Decodable>(path: String, method: String, token: String?, body: Body?) async throws -> Response {
        if let token {
            guard UserDefaults.standard.string(forKey: "pharmavault.session.endpoint") == APIConfiguration.baseURLString,
                  try KeychainStore.read() == token else { throw AppError.unauthorized }
        }
        let dataBody = try body.map { try encoder.encode($0) }
        let request = ClientPolicy.request(baseURL: try APIConfiguration.baseURL(), path: path, method: method, token: token, body: dataBody)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppError.server("No response from the server.") }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw AppError.unauthorized }
            if (300...399).contains(http.statusCode) { throw AppError.server("The API redirected this request. Configure its final HTTPS address; no credentials were forwarded.") }
            let error = try? decoder.decode(APIErrorBody.self, from: data)
            let detail = error?.detail ?? error?.message ?? "Request failed (HTTP \(http.statusCode))."
            throw AppError.server(detail)
        }
        if Response.self == EmptyResponse.self { return EmptyResponse() as! Response }
        return try decoder.decode(Response.self, from: data)
    }
}

private struct EmptyResponse: Decodable {}

// MARK: - Session

@MainActor
final class AppSession: ObservableObject {
    private let endpointKey = "pharmavault.session.endpoint"
    private var generation = UUID()
    @Published private(set) var user: AuthResponse?
    @Published var isLoading = true
    @Published var message: String?

    init() {
        UserDefaults.standard.removeObject(forKey: "pharmavault.session.profile")
        Task { await restoreSession() }
    }

    func signIn(email: String, password: String, role: UserRole) async {
        let attempt = generation
        let endpoint = APIConfiguration.baseURLString
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await PharmaVaultAPI.shared.login(email: email, password: password, role: role)
            guard attempt == generation, endpoint == APIConfiguration.baseURLString else { return }
            try KeychainStore.save(token: response.token)
            UserDefaults.standard.set(endpoint, forKey: endpointKey)
            user = response
            message = nil
        } catch {
            message = error.localizedDescription
        }
    }

    func signOut() {
        generation = UUID()
        KeychainStore.delete()
        UserDefaults.standard.removeObject(forKey: endpointKey)
        UserDefaults.standard.removeObject(forKey: "pharmavault.session.profile")
        user = nil
        message = nil
    }

    func configureEndpoint(_ value: String) throws {
        // Validate first, then invalidate the old environment's session.
        let endpoint = try ClientPolicy.endpoint(value)
        signOut()
        try APIConfiguration.save(baseURLString: endpoint.absoluteString)
    }

    func handleSessionError(_ error: Error, token: String? = nil) {
        if let token, user?.token != token { return }
        if let appError = error as? AppError, case .unauthorized = appError {
            signOut()
            message = error.localizedDescription
        }
    }

    func restoreSession() async {
        isLoading = true
        let attempt = generation
        let endpoint = APIConfiguration.baseURLString
        defer { isLoading = false }
        do {
            guard APIConfiguration.isConfigured else { return }
            guard ClientPolicy.canRestoreSession(savedEndpoint: UserDefaults.standard.string(forKey: endpointKey), currentEndpoint: endpoint) else { signOut(); return }
            guard let token = try KeychainStore.read() else { return }
            let profile = try await PharmaVaultAPI.shared.fetchProfile(token: token)
            guard attempt == generation, endpoint == APIConfiguration.baseURLString else { return }
            let restored = AuthResponse(id: profile.id, name: profile.name, email: profile.email, role: profile.role, token: token)
            user = restored
        } catch {
            // Only a definite 401 clears a valid saved token. Offline/TLS errors
            // keep the user signed out but allow an explicit retry.
            guard attempt == generation, endpoint == APIConfiguration.baseURLString else { return }
            handleSessionError(error)
            message = error.localizedDescription
        }
    }
}

// MARK: - Root and login

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if session.isLoading {
                ProgressView("Preparing secure session…")
            } else if session.user == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .tint(.indigo)
        .alert("PharmaVault", isPresented: Binding(get: { session.message != nil }, set: { if !$0 { session.message = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(session.message ?? "") }
    }
}

struct LoginView: View {
    @EnvironmentObject private var session: AppSession
    @State private var email = ""
    @State private var password = ""
    @State private var role: UserRole = .patient
    @State private var apiURL = APIConfiguration.baseURLString
    @State private var endpointMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("PharmaVault")
                        .font(.largeTitle.bold())
                    Text("Secure document scanning for evidence-grounded verification. This MVP does not diagnose or approve claims automatically.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Sign in") {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                    Picker("Portal", selection: $role) {
                        ForEach(UserRole.allCases) { Text($0.label).tag($0) }
                    }
                }
                Section("Backend setup — available before login") {
                    TextField("https://your-backend.example/api", text: $apiURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    Button("Save HTTPS backend") {
                        do {
                            try session.configureEndpoint(apiURL)
                            apiURL = APIConfiguration.baseURLString
                            password = ""
                            endpointMessage = "Backend saved. Sign in with an existing account."
                        } catch { endpointMessage = error.localizedDescription }
                    }
                    if let endpointMessage { Text(endpointMessage).font(.footnote) }
                    Text("A real iPhone needs a reachable HTTPS server with a trusted certificate. localhost on the phone is not your laptop. Staff accounts must be provisioned by an authorized administrator.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Button("Sign in securely") {
                        Task { await session.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password, role: role) }
                    }
                    .disabled(email.isEmpty || password.isEmpty || session.isLoading || !APIConfiguration.isConfigured)
                    Button("Retry saved session") { Task { await session.restoreSession() } }
                        .disabled(!APIConfiguration.isConfigured || session.isLoading)
                }
            }
            .navigationTitle("Welcome")
        }
    }
}

// MARK: - Scanner and upload

struct MainTabView: View {
    var body: some View {
        TabView {
            ScanUploadView()
                .tabItem { Label("Scan", systemImage: "doc.viewfinder") }
            CaseListView()
                .tabItem { Label("My cases", systemImage: "checklist") }
            PrivacySettingsView()
                .tabItem { Label("Privacy", systemImage: "lock.shield") }
        }
    }
}

@MainActor
final class ScanUploadViewModel: ObservableObject {
    @Published var documentType: DocumentType = .prescription
    @Published var scannedImage: UIImage?
    @Published var scannedPageCount = 0
    @Published var isScannerPresented = false
    @Published var isUploading = false
    @Published var message: String?
    @Published var createdCase: VerificationCase?
    @Published private(set) var uploadedTypes: Set<String> = []
    @Published var needsCameraSettings = false
    @Published var sessionExpired = false
    @Published private(set) var didProcess = false

    func openScanner() async {
        guard !isUploading else { return }
        needsCameraSettings = false
        guard VNDocumentCameraViewController.isSupported else {
            message = "Document scanning is unavailable on this device. Use a supported physical iPhone/iPad, or upload documents through the web app."
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: isScannerPresented = true
        case .notDetermined:
            if await AVCaptureDevice.requestAccess(for: .video) { isScannerPresented = true }
            else { needsCameraSettings = true; message = "Camera access was denied. Enable it in Settings to scan a document." }
        case .denied:
            needsCameraSettings = true
            message = "Camera access is off. Enable PharmaVault camera access in Settings."
        case .restricted:
            message = "Camera access is restricted on this device. Use the web upload workflow."
        @unknown default: message = "Camera permission is unavailable. Use the web upload workflow."
        }
    }

    func discardScan() { scannedImage = nil; scannedPageCount = 0 }

    func startNewCase() {
        discardScan()
        createdCase = nil
        uploadedTypes = []
        didProcess = false
        documentType = .prescription
        message = "Ready for a new case. Any previously uploaded case remains on the server."
    }

    func receiveScan(_ pages: [UIImage]) {
        discardScan()
        do {
            try ClientPolicy.requireSinglePage(pages.count)
            scannedImage = pages[0]
            scannedPageCount = 1
            message = "Review this page and its document type before choosing Upload."
        } catch { message = error.localizedDescription }
    }

    func upload(token: String) async {
        guard let image = scannedImage else { message = "Scan a document before uploading."; return }
        guard !isUploading else { return }
        guard !uploadedTypes.contains(documentType.rawValue) else { message = "This document type is already uploaded. Start a new case for another set of documents."; return }
        let uploadType = documentType
        isUploading = true
        defer { isUploading = false }
        do {
            if createdCase == nil {
                createdCase = try await PharmaVaultAPI.shared.createCase(subjectReference: nil, token: token)
            }
            guard let caseID = createdCase?.id else { throw AppError.server("Unable to create a verification case.") }
            try await PharmaVaultAPI.shared.upload(image: image, type: uploadType, caseID: caseID, token: token)
            uploadedTypes.insert(uploadType.rawValue)
            discardScan()
            message = "\(uploadType.title) uploaded to case \(createdCase?.caseReference ?? caseID). Upload the remaining document types before running verification."
        } catch {
            if let appError = error as? AppError, case .unauthorized = appError { sessionExpired = true }
            message = error.localizedDescription
        }
    }

    func process(token: String) async {
        guard !isUploading, ClientPolicy.canProcess(uploadedTypes: uploadedTypes), let caseID = createdCase?.id else { return }
        isUploading = true
        defer { isUploading = false }
        do {
            createdCase = try await PharmaVaultAPI.shared.processCase(caseID: caseID, token: token)
            didProcess = true
            message = "Verification finished: \(createdCase?.status.replacingOccurrences(of: "_", with: " ") ?? "review pending"). Open the web reviewer workflow to inspect evidence and record a human decision."
        } catch {
            if let appError = error as? AppError, case .unauthorized = appError { sessionExpired = true }
            message = error.localizedDescription
        }
    }
}

struct ScanUploadView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var model = ScanUploadViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var confirmNewCase = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Scan a verification document")
                            .font(.title2.bold())
                        Text("Capture a clear image. It is kept in memory until you explicitly choose Upload; it is not saved to the photo library by this app.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Picker("Document type", selection: $model.documentType) {
                        ForEach(DocumentType.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .disabled(model.isUploading)
                    .onChange(of: model.documentType) { _, _ in model.discardScan() }

                    if let item = model.createdCase {
                        Text("Case: \(item.caseReference)").font(.caption.monospaced())
                    }
                    ForEach(DocumentType.allCases) { type in
                        Label(type.title, systemImage: model.uploadedTypes.contains(type.rawValue) ? "checkmark.circle.fill" : "circle")
                            .font(.caption)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Group {
                        if let image = model.scannedImage {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFit()
                                .frame(maxHeight: 360)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .accessibilityLabel("Scanned \(model.documentType.title)")
                        } else {
                            ContentUnavailableView("No document scanned", systemImage: "doc.viewfinder", description: Text("Use the camera scanner to capture one clear page."))
                                .frame(height: 300)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    Button { Task { await model.openScanner() } } label: {
                        Label(model.scannedImage == nil ? "Open secure scanner" : "Scan again", systemImage: "camera.viewfinder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isUploading || model.uploadedTypes.contains(model.documentType.rawValue))

                    if model.needsCameraSettings {
                        Button("Open camera settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                        }
                    }
                    if model.scannedImage != nil {
                        Button("Discard this scan", role: .destructive) { model.discardScan() }
                            .disabled(model.isUploading)
                    }

                    Button {
                        guard let token = session.user?.token else { return }
                        Task {
                            await model.upload(token: token)
                            if model.sessionExpired, session.user?.token == token { session.signOut(); session.message = AppError.unauthorized.localizedDescription }
                        }
                    } label: {
                        Label(model.isUploading ? "Uploading…" : "Upload \(model.documentType.title)", systemImage: "lock.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.scannedImage == nil || model.isUploading || model.uploadedTypes.contains(model.documentType.rawValue))

                    if ClientPolicy.canProcess(uploadedTypes: model.uploadedTypes), !model.didProcess {
                        Button("Run verification") {
                            guard let token = session.user?.token else { return }
                            Task {
                                await model.process(token: token)
                                if model.sessionExpired, session.user?.token == token { session.signOut(); session.message = AppError.unauthorized.localizedDescription }
                            }
                        }
                        .buttonStyle(.borderedProminent).disabled(model.isUploading)
                    }
                    if model.createdCase != nil {
                        Button("Start a new case") { confirmNewCase = true }.disabled(model.isUploading)
                    }

                    if let message = model.message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(.indigo.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding()
            }
            .navigationTitle("Scan & upload")
            .confirmationDialog("Start a new case? Uploaded documents remain on the server; any unuploaded scan will be discarded.", isPresented: $confirmNewCase, titleVisibility: .visible) {
                Button("Start new case") { model.startNewCase() }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background { model.discardScan(); model.isScannerPresented = false }
            }
            .sheet(isPresented: $model.isScannerPresented) {
                DocumentCameraScanner { result in
                    model.isScannerPresented = false
                    switch result {
                    case .success(let pages): model.receiveScan(pages)
                    case .failure(let error) where error is CancellationError: break
                    case .failure(let error): model.discardScan(); model.message = error.localizedDescription
                    }
                }
            }
        }
    }
}

struct DocumentCameraScanner: UIViewControllerRepresentable {
    let completion: (Result<[UIImage], Error>) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let completion: (Result<[UIImage], Error>) -> Void
        init(completion: @escaping (Result<[UIImage], Error>) -> Void) { self.completion = completion }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            completion(.failure(CancellationError()))
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            completion(.failure(error))
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            do {
                // Check before materializing images; never retain a multi-page scan.
                try ClientPolicy.requireSinglePage(scan.pageCount)
                completion(.success([scan.imageOfPage(at: 0)]))
            } catch { completion(.failure(error)) }
        }
    }
}

// MARK: - Cases and privacy settings

struct CaseListView: View {
    @EnvironmentObject private var session: AppSession
    @State private var cases: [VerificationCase] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading cases…")
                } else if let error {
                    ContentUnavailableView("Cases unavailable", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if cases.isEmpty {
                    ContentUnavailableView("No verification cases", systemImage: "checklist", description: Text("Scan and upload a document to create your first case."))
                } else {
                    List(cases) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.caseReference).font(.headline.monospaced())
                            Text(item.status.replacingOccurrences(of: "_", with: " ")).font(.caption).foregroundStyle(.secondary)
                            if item.reviewRequired { Label("Human review required", systemImage: "person.badge.shield.checkmark").font(.caption).foregroundStyle(.orange) }
                        }
                    }
                }
            }
            .navigationTitle("My cases")
            .toolbar {
                Button("Refresh") { Task { await loadCases() } }
            }
            .task { await loadCases() }
        }
    }

    private func loadCases() async {
        guard let token = session.user?.token else { return }
        isLoading = true
        defer { isLoading = false }
        do { cases = try await PharmaVaultAPI.shared.fetchCases(token: token); error = nil }
        catch {
            session.handleSessionError(error, token: token)
            self.error = error.localizedDescription
        }
    }
}

struct PrivacySettingsView: View {
    @EnvironmentObject private var session: AppSession
    @State private var apiURL = APIConfiguration.baseURLString
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Privacy commitments") {
                    Label("Session token stored in this device's Keychain", systemImage: "key.horizontal")
                    Label("Scans stay in memory until you choose Upload", systemImage: "memorychip")
                    Label("No API key or Gemini key is stored in the app", systemImage: "lock.shield")
                    Text("AI supports evidence review; pharmacists or claims reviewers remain accountable for final decisions.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Secure API configuration") {
                    TextField("HTTPS API URL", text: $apiURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    Button("Save HTTPS endpoint") {
                        do {
                            try session.configureEndpoint(apiURL)
                            message = "Saved. Your previous session was signed out; sign in to the new endpoint."
                        }
                        catch { message = error.localizedDescription }
                    }
                    Text("Use an HTTPS endpoint for a real device. Never paste a Gemini key, JWT secret, or database password here.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section {
                    Button("Sign out from this device", role: .destructive) { session.signOut() }
                }
                if let message { Section { Text(message).font(.footnote) } }
            }
            .navigationTitle("Privacy")
        }
    }
}
