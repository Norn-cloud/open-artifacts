Feature: Approved reference DNA is a static artifact-authoring input

  As an agent using an approved design reference
  I want the reference facts to be explicit, safe, and versioned with my Recipe
  So that I can preserve the useful structural direction without publishing a
  runtime dependency, copied source material, or unverified provenance

  Scenario: An attested shared reference DNA sidecar builds without entering published content
    Given a shared HTML Recipe whose document.referenceDna points to a shared DNA sidecar
    And the sidecar records a public reference for the user's own brand with a URL provenance
    When the agent runs the artifact script with validate
    Then the build succeeds
    And the composed output does not contain the source URL or DNA sidecar contents
    And the Recipe input hash includes the sidecar

  Scenario: A screenshot DNA sidecar records no raw screenshot or source URL
    Given a shared HTML Recipe whose reference DNA sidecar records a user-supplied screenshot
    When the agent runs the artifact script with validate
    Then the build succeeds with sourceMode user-supplied-image
    And the sidecar contains no raw image bytes or source URL

  Scenario: A reference DNA sidecar rejects third-party or missing attestation
    Given a Recipe whose reference DNA sidecar claims a URL source without user-owned or public-reference-for-own-brand attestation
    When the agent runs the artifact script with validate
    Then the build fails naming reference DNA attestation
    And no publish request is made

  Scenario: A reference DNA sidecar rejects source payloads and unknown fields
    Given a Recipe whose reference DNA sidecar contains fetched HTML, CSS, JavaScript, copied text, remote assets, or an unknown key
    When the agent runs the artifact script with validate
    Then the build fails naming the unsupported DNA field
    And no publish request is made

  Scenario: Shared and private reference DNA source locations must match Recipe locality
    Given a shared Recipe that points to a local reference DNA sidecar
    Or a local or encrypted Recipe that points to a shared reference DNA sidecar
    When the agent runs the artifact script with validate
    Then the build fails explaining the matching reference DNA source location

  Scenario: Editing approved reference DNA marks the artifact stale
    Given a published Recipe that references an approved DNA sidecar
    And the sidecar changes after the artifact is published
    When the agent runs the artifact script with status
    Then the artifact is reported stale even if artifact.watch omits the sidecar

  Scenario: Existing Recipes remain unchanged without reference DNA
    Given an existing Recipe without document.referenceDna
    When the agent runs validate, build, create, or update
    Then its output and validation behavior remain unchanged
