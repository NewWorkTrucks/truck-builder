# NWT Truck Builder — High-Level User Story

> Base reference for the product's goal. Work is measured against the
> acceptance criteria (§4) and the Definition of Done (§6). This story
> describes the intended complete experience; it does not imply that every
> criterion is already implemented.

## Epic: Configure a Work Truck and Request a Quote

**As a** business owner, contractor, or fleet manager,
**I want to** visually configure a work truck with the equipment and upfits my business needs, review the resulting build, and submit it to New Work Trucks,
**so that** I can clearly communicate my requirements and receive an accurate quotation and availability guidance without searching multiple dealerships or describing every detail over the phone.

**Supporting operations story:**
As an NWT team member, I want to receive a complete, traceable customer request with its configuration and visual reference, so that I can validate requirements, coordinate sourcing, and prepare a quotation with minimal clarification.

## 1. User Need and Business Value

Customers know the work they need a truck to perform, but communicating the exact vehicle, body, and equipment combination can be difficult. Traditional inventory browsing and phone conversations can result in incomplete specifications, incompatible selections, and repeated clarification.

The Truck Builder should provide a shared visual understanding between the customer and NWT.

### Customer value

- Explore supported configurations in one place.
- Understand how selected equipment changes the truck.
- Communicate requirements clearly.
- Retrieve a submitted build for reference.
- Receive personalized assistance with pricing and availability.

### Business value

- Capture more complete and actionable quote requests.
- Reduce manual intake and misunderstanding.
- Standardize how requested builds reach operations.
- Support efficient sourcing and quotation.
- Create a foundation for additional models and future automation.

## 2. Primary User Journey

### A. Discover and enter

As a customer, I can access the Truck Builder from the NWT website and quickly understand what it does.

- The introduction explains the configure-and-request process.
- I can proceed to configuration without unnecessary friction.
- A repeat visitor should be able to bypass introductory content.
- The experience makes clear that submitting a build requests a quotation; it does not purchase or reserve a truck.

### B. Configure my truck

As a customer, I can select a supported truck configuration and add suitable equipment.

- Available choices use understandable names.
- My selections are reflected in the 3D preview.
- I can rotate, zoom, and use preset views.
- I can inspect individual components through the parts view and highlighting.
- Incompatible combinations are prevented or clearly explained.
- Offered colors accurately represent the intended choices without implying unverified stock availability.

The supported catalog defines what I can configure; the experience does not imply that every vehicle or upfit is available.

### C. Review my build

As a customer, I can review my selections before submitting them.

- The visual preview and written summary agree.
- I can identify the selected truck, body, and upfits.
- I can return to configuration to make changes.
- The review distinguishes my requested specification from confirmed pricing and availability.

### D. Submit a quote request

As a customer, I can provide the contact and delivery information NWT needs and submit my build.

- Information already captured in the configuration does not need to be re-entered.
- Required fields are clearly identified and validated.
- My customer details and configuration remain associated with the same request.
- I receive a clear success or failure message.
- A successful submission provides a reference code or equivalent confirmation.
- Submission problems do not silently lose my request or misrepresent it as received.

### E. Retrieve and share my specification

As a customer, I can use my reference code to retrieve the submitted build.

- The preview represents the configuration I submitted.
- I can view and print the specification.
- Parts are clearly identified using concise labels and a legend.
- The specification includes appropriate customer identification and NWT branding.
- Retrieval does not expose another customer's information.

Whether retrieved builds can be edited or resubmitted requires a separate product decision.

## 3. NWT Operations Journey

### A. Receive and track the request

As an NWT team member, I can find submitted Truck Builder requests in NWTOS.

Each request provides access to:

- A unique reference
- Customer contact information
- The requested truck and selected equipment
- A corresponding visual preview
- Submission details sufficient for follow-up

Requests must also reach the sales team through the approved operational channel while monday.com remains in use. The final routing and notification arrangement must be verified.

### B. Validate and fulfill

As an NWT team member, I can review the build, clarify any outstanding requirements, and begin sourcing.

- I can compare the written configuration with its visual reference.
- I can contact the customer using the submitted details.
- I can use the specification to coordinate with dealers and upfitters.
- Dealer-facing sourcing information excludes customer-identifying details unless separately authorized.
- I can prepare a quotation through the separate operational quoting process.

### C. Maintain the experience

As an authorized NWT administrator or engineering team member, I can maintain the supported catalog and presentation.

- New assets have verified usage rights.
- Models, materials, names, and compatibility rules remain consistent.
- Changes are tested before release.
- Previously submitted requests remain interpretable when the catalog changes.

## 4. High-Level Acceptance Criteria

The epic is successful when:

1. **Discoverability:** Customers can reach the builder and understand the request process.
2. **Configuration:** Supported selections update the preview correctly.
3. **Compatibility:** Invalid combinations cannot be submitted without clear handling.
4. **Accuracy:** The review, stored request, and printable preview describe the same build.
5. **Submission:** Valid requests are saved with customer details and a unique reference.
6. **Operational visibility:** NWT staff can locate and act on each successful request.
7. **Confirmation:** Customers receive clear submission results; any promised notifications work.
8. **Retrieval:** Valid reference codes open the correct submitted specification with appropriate access protection.
9. **Usability:** The experience works across an agreed set of desktop and mobile devices.
10. **Reliability:** Failures are visible and recoverable; supported capacity is established through testing.
11. **Commercial clarity:** Configuration does not imply confirmed stock, final pricing, or a completed purchase.
12. **Compliance:** Published models, branding, and software have appropriate permissions.

## 5. Scope Boundaries

### Core experience

- Website entry and introductory experience
- Supported truck and upfit configuration
- Interactive 3D inspection
- Build review
- Customer intake and request submission
- Request reference and retrieval
- Printable specification
- NWTOS request visibility
- Verified sales routing and notifications

### Future enhancements

These require separate stories and should not block the core workflow unless explicitly prioritized:

- Live dealer-inventory matching
- Stock-aware color selection and quantity display
- Automated dealer/upfitter routing
- AI-generated configurations or recommendations
- AI-assisted proposal preparation
- Broader vehicle and upfit coverage
- Customer accounts and editable saved builds
- Online checkout, payments, or reservations

## 6. Definition of Done

This epic is complete when a customer can configure a supported truck, submit it successfully, retrieve the correct specification, and have NWT receive enough accurate information to begin a quotation.

Completion requires a verified end-to-end workflow—not only a successful 3D demonstration—and supporting operational instructions, appropriate access controls, asset licensing checks, and agreed performance testing.

**Status note:** This story describes the intended complete experience. It does not imply that all acceptance criteria or capabilities are already implemented.
