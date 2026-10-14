# PharmaVault TrustRAG Authorization Matrix

## Roles Defined
1. `patient`: Original document submitter (or proxy).
2. `pharmacist` / `pharmacy` (legacy): Staff processing verifications within a specific tenant organization.
3. `claims_reviewer`: Specialized staff adjudicating complex health claims.
4. `org_admin`: Administrator for a specific tenant organization.
5. `super_admin`: Global platform administrator.
6. `research_evaluator`: Researcher studying non-identifiable clinical outcomes.

## Tenant Scoping Rule
All access by `pharmacist`, `claims_reviewer`, and `org_admin` is strictly filtered by the user's `organizationId`. Accessing a `caseId` belonging to another organization explicitly returns `404 Not Found` to prevent data leakage and obscure the existence of cross-tenant records.

## Endpoint Permissions Map

| Endpoint | Method | `patient` | `pharmacist` | `claims_reviewer` | `org_admin` | `super_admin` | `research_evaluator` |
|----------|--------|-----------|--------------|-------------------|-------------|---------------|----------------------|
| `/cases` | POST | Own Only | Tenant | Tenant | Tenant | Deny | Deny |
| `/cases` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |
| `/cases/{caseId}` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |
| `/cases/{caseId}` | PATCH | Deny | Tenant | Tenant | Tenant | Deny | Deny |
| `/cases/{caseId}/documents` | POST | Own Only | Tenant | Tenant | Tenant | Deny | Deny |
| `/cases/{caseId}/documents` | GET | Own Only | Tenant | Tenant | Tenant | All | Deny (No raw docs) |
| `/cases/{caseId}/documents/{docId}` | GET | Own Only | Tenant | Tenant | Tenant | All | Deny (No raw docs) |
| `/cases/{caseId}/documents/{docId}` | DELETE | Own Only | Tenant | Deny | Tenant | Deny | Deny |
| `/cases/{caseId}/process` | POST | Own Only | Tenant | Tenant | Tenant | Deny | Deny |
| `/cases/{caseId}/processing-status` | GET | Own Only | Tenant | Tenant | Tenant | All | Deny |
| `/cases/{caseId}/results` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |
| `/cases/{caseId}/evidence` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |
| `/cases/{caseId}/extracted-fields/{id}` | PATCH | Deny | Tenant | Tenant | Tenant | Deny | Deny |
| `/review-queue` | GET | Deny | Tenant | Tenant | Tenant | All | Deny |
| `/cases/{caseId}/reviews` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |
| `/cases/{caseId}/reviews` | POST | Deny | Tenant | Tenant | Tenant | Deny | Deny |
| `/cases/{caseId}/fhir-bundle` | GET | Own Only | Tenant | Tenant | Tenant | All | All (De-identified) |

## Legacy Compatibility
The role name `pharmacy` is currently used in legacy runtime code. For this API contract, `pharmacy` maps equivalently to `pharmacist`.

*(Note: New roles are not implemented in runtime code during this work order, but are defined for future enforcement.)*
