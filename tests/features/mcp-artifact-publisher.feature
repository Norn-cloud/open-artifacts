Feature: Independent MCP project artifact publishing
  The MCP registry supports project hubs and independent public artifacts.

  Scenario: Publish a versioned artifact without replacing the project hub
    Given a project has a stable hub artifact
    When an authenticated MCP client publishes two valid lowercase-kebab artifacts for that project
    And it publishes one of those artifact slugs again
    Then each slug has its own public artifact URL
    And the repeated slug versions the same artifact
    And the project hub URL and content remain unchanged
    And the result identifies only the project, slug, and public artifact metadata

  Scenario: Artifact identities remain isolated
    Given two allowed projects use the same valid artifact slug
    When each project publishes that slug through MCP
    Then they receive different artifact identities
    And no response exposes channel hashes, write tokens, or MCP secrets
