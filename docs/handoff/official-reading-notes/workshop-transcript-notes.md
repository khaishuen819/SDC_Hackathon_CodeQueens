# AlphaRed workshop recording: transcript reading notes

Source: [Workshop 1: AlphaRed (Agentic Development)](https://drive.google.com/drive/folders/1sWs2gnuY_Mfa_SCvHzEpS1Tw4XYvXYgF), **2. SDC Workshop: Alpha Red (Recording)**, approximately 50:46. Read the complete Drive transcript from 0:00 through the last segment at 50:44 on 20 October 2026. Unlike the other eight videos, this recording exposes a full transcript and captions. The transcript contains recognition errors, so unclear model/product names and spoken price examples are not treated as verified specifications. Visual-only code demonstrations were not independently reconstructed from the recording. The separate 39-page Orbyte deck was fully read and visually reviewed; see workshop-orbyte-notes.md.

## Agent development section, 0:00–26:59

- Opening introduces practical agent development using Cloudflare, after participants set up an IDE and coding agent from previously distributed links.
- At 1:33–2:33, the proposed stack combines a React frontend and TanStack tools, Cloudflare D1 (SQLite-style persistence), Workers AI for model access, and scheduled callbacks. Exact frontend package names are unclear in the automatic transcript.
- At 2:40–5:09, a hackathon FAQ assistant illustrates combining a user question with system instructions and relevant event context. The same material is repeated after a screen-sharing interruption around 5:53–7:23 and audio checks around 8:15. Streaming returns responses incrementally.
- At 9:51–11:27, retrieval augmented generation addresses limited context: search a large knowledge base, extract relevant chunks, combine those with instructions and the user's question. Cloudflare AI Search is presented as a managed option to avoid rebuilding the retrieval infrastructure.
- At 11:39–12:41, tool calling extends a language model with named application functions. The application executes requested functions, returns structured results, and lets the model continue. External tools may be hosted separately.
- At 12:56–13:27, impose an iteration limit on agent loops. More rounds also cost more; unbounded execution is undesirable.
- At 13:52–15:04, persistent state/memory prevents loss of context across visits. Store user-specific state in D1 and selectively restore it into later prompts.
- At 15:14–18:30, structured extraction and classification/decision APIs are introduced as faster, cheaper routes for specific tasks than unconstrained text generation. Examples include extracting JSON fields, identifying missing information, and routing a request between choices. The automatic transcription of vendor/model names is unreliable. Claims about multimodal support and per-million pricing are speaker examples, not verified current product facts.
- At 18:43–19:21, human approval gates are proposed for consequential actions, such as payments. A pending action is reviewed/approved before execution.
- At 19:32–20:27, scheduled callbacks run periodic or deferred work (for example after 30 seconds), avoiding an indefinitely blocked request.
- At 20:38–21:48, CLI and MCP serve different access patterns: local commands can be fast, while hosted business/SaaS data and shared tool descriptions benefit from MCP. Large tool catalogs can consume context, motivating discovery/tool search.
- At 22:11–23:17, an agent harness coordinates model, tools, state and execution. Existing harnesses are a reasonable starting point; customizing becomes useful for a demonstrated limitation. A Cloudflare-hosted harness example is mentioned.
- At 23:40–26:59, generated/rich UI is contrasted with plain text output: HTML/components/forms, validation and persistence can support interaction. A sample application is shown and participants are invited to explore it. The transcript alone does not provide the complete code or URL.

## Orbyte platform introduction and demonstration, 28:35–44:14

- After a presenter handover/permission interruption, a second speaker introduces Orbyte as an AI-native SME platform, intended to start free and price selected usage rather than seats.
- Its aim is to combine operational business context with AI. Generic chat lacks the organization's specific resources, inventory, permissions, routing and pending tasks. Shared identity/workflow/context is intended to support consistent actions across staff.
- The product is described as one workspace and ecosystem into which native modules and third-party applications connect. It is intended to coordinate across operational tools rather than require every small business to adopt a large suite at once.
- Existing examples include leave/overtime, attendance, projects/tasks, daily status/KPIs, claims, hiring/CV screening, e-signing, user directory, approvals and a Connect integration gateway.
- Integrations are bidirectional: Orbyte can access external services and external providers can add services to the ecosystem. Accounting/payroll/payment partners and additional modules are discussed as plans; not every shown module is enabled in the participant staging environment.
- At 37:13–38:07, the architecture places applications above shared workflow, roles/permissions, users and documents, with integration and AI access underneath. Microsoft, Google and Apple sign-in are mentioned.
- At 38:14–39:34, use only relevant modules initially; a transaction/usage charging model is discussed, with many modules free. No exact production rate card is supplied.
- At 40:30–44:14, the speaker shows staging/account features: notifications and approvals, clients/projects/users, work status/blockers, Azure DevOps integration, meeting transcript summaries, HR/talent operations and e-signing. A future mobile app and wallet are described, not established here as already generally available.

## Q&A, 44:19–50:44

- The staging environment is for understanding the product and envisioning user workflows; participants can explore it using their own accounts. No account was created during this reading.
- Full production integration is not necessary for the demonstrated challenge; mocked data/processes can simulate a proposed transition/workflow. This is workshop guidance associated with the Orbyte context and must not replace Domain 1's requirement for an updatable, sourced trend layer.
- Integration can work in either direction, extending shared workflow/permissions/directory or providing an externally connectable service.
- The intended business users are owners and staff, including small organizations currently coordinating through spreadsheets and documents.
- Presenter offers to share the introduction deck through the committee. Session ends after final questions.

## Reading limitations

The complete available spoken transcript was read, but no claim is made to have executed or visually verified every demonstrated code sample. Treat exact names, costs and API capabilities as potentially mistranscribed or time-sensitive. The recording provides technical concepts and product context; it does not establish a replacement submission deadline or judging rubric.
