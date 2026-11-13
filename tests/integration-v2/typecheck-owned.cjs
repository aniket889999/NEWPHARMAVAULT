'use strict';
// Full strict diagnostics remain visible; scoped success never means the whole app builds.
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const config = ts.readConfigFile(path.join(root, 'tsconfig.app.json'), ts.sys.readFile);
if (config.error) throw new Error('Cannot read the real application compiler configuration.');
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
const existing = new Set(['pages/CaseDetailPage.tsx', 'pages/CreateCaseWizardPage.tsx', 'api/verificationApi.ts', 'types.ts',
  'components/ReviewActionModal.tsx', 'components/DocumentEvidenceViewer.tsx', 'components/ExtractedFieldsEditor.tsx', 'components/LifecycleStepper.tsx'].map(file => path.join(root, 'src/modules/verification', file)));
const owned = diagnostics.filter(item => item.file && (existing.has(item.file.fileName) || item.file.fileName.startsWith(path.join(root, 'src/modules/verification/integration') + path.sep)));
console.log(JSON.stringify({ scope: 'Session 3 integration and explicitly owned frontend files', ownedDiagnostics: owned.length, fullAppDiagnostics: diagnostics.length, fullAppPassed: diagnostics.length === 0 }));
if (owned.length) console.error(ts.formatDiagnosticsWithColorAndContext(owned, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
process.exitCode = owned.length ? 1 : 0;
