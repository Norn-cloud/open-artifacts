Feature: Artifact quality profile prevents recurring generated-layout defects

  As an agent authoring a shareable HTML artifact
  I want the build to reject mechanically detectable design defects
  So that an artifact which passes validation is readable, coherent, and safe to
  inspect at common viewport widths without replacing the established Recipe,
  token, or Canvas contracts

  Scenario: An italic display heading fails validation
    Given an HTML recipe whose authored CSS applies font-style:italic to an h1
    When the agent runs the artifact script with validate
    Then the build fails explaining that display headings use roman type
    And no publish request is made

  Scenario: Italic running prose passes validation
    Given an HTML recipe whose authored CSS applies font-style:italic only to an em
      element inside a paragraph
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: A primary affordance without single-line text fails validation
    Given an HTML recipe whose body contains a primary CTA link and its authored CSS
      does not apply white-space:nowrap to that affordance
    When the agent runs the artifact script with validate
    Then the build fails explaining that primary affordances must remain single-line
    And no publish request is made

  Scenario: A primary affordance with single-line text passes validation
    Given an HTML recipe whose body contains a primary CTA link and its authored CSS
      applies white-space:nowrap to that affordance
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: An image-bearing grid with an unconstrained fraction track fails validation
    Given an HTML recipe whose body places an image in a CSS Grid with grid-template-columns:1fr 1fr
    When the agent runs the artifact script with validate
    Then the build fails explaining that image-bearing fraction tracks use minmax(0, 1fr)
    And no publish request is made

  Scenario: An image-bearing grid with constrained fraction tracks passes validation
    Given an HTML recipe whose body places an image in a CSS Grid with
      grid-template-columns:minmax(0, 1fr) minmax(0, 1fr)
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: A display heading without emergency long-word wrapping fails validation
    Given an HTML recipe whose CSS defines a display h1 without overflow-wrap:anywhere and min-width:0
    When the agent runs the artifact script with validate
    Then the build fails explaining that display headings need emergency wrapping
    And no publish request is made

  Scenario: A display heading with emergency long-word wrapping passes validation
    Given an HTML recipe whose CSS defines a display h1 with overflow-wrap:anywhere and min-width:0
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: A multi-column section head with an eyebrow and heading lacks a mobile collapse
    Given an HTML recipe whose section header contains an eyebrow and h2, uses a multi-column grid,
      and has no narrow-viewport single-column override
    When the agent runs the artifact script with validate
    Then the build fails explaining that the section head needs a mobile single-column layout
    And no publish request is made

  Scenario: A multi-column section head with a narrow-viewport collapse passes validation
    Given an HTML recipe whose section header contains an eyebrow and h2, uses a multi-column grid,
      and has a narrow-viewport override to one column
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: A secondary sticky element overlaps a top sticky nav
    Given an HTML recipe with a top-level sticky nav at top:0 and another sticky element at top:0
    When the agent runs the artifact script with validate
    Then the build fails explaining that the secondary sticky element needs an offset
    And no publish request is made

  Scenario: A secondary sticky element offset below a top sticky nav passes validation
    Given an HTML recipe with a top-level sticky nav at top:0 and a second sticky element
      offset using a banner-height token
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: Decorative fake browser chrome fails validation
    Given an HTML recipe whose markup combines a browser-chrome class, traffic-light dots,
      and a URL-bar-shaped element
    When the agent runs the artifact script with validate
    Then the build fails explaining that the viewer owns browser chrome
    And no publish request is made

  Scenario: A real artifact prototype is not mistaken for fake browser chrome
    Given an HTML recipe whose interactive body contains real controls but no browser-chrome marker
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: A raw component color fails token-drift validation
    Given an HTML recipe whose component CSS uses an inline hex, OKLCH, RGB, or HSL color
    When the agent runs the artifact script with validate
    Then the build fails explaining that visual values belong in the theme token blocks
    And no publish request is made

  Scenario: A theme token used by a component passes token-drift validation
    Given an HTML recipe whose theme block defines a color token and component CSS consumes it with var(...)
    When the agent runs the artifact script with validate
    Then the build succeeds

  Scenario: Canvas skips document-level quality gates that conflict with its runtime
    Given a canvas HTML recipe whose authored frame content uses the Canvas runtime contract
    When the agent runs the artifact script with validate
    Then the build preserves Canvas overflow and layout ownership
    And only Canvas-specific validation applies

  Scenario: A scrolling HTML artifact passes the browser quality smoke test
    Given an HTML recipe whose rendered document has no horizontal scroll or heading overflow
      at 320px, 375px, 414px, and 768px
    When the agent runs the artifact script with smoke
    Then the command succeeds and reports those four viewport widths

  Scenario: A scrolling HTML artifact with a narrow-viewport overflow fails the browser quality smoke test
    Given an HTML recipe whose rendered document scrolls horizontally at one of the required widths
    When the agent runs the artifact script with smoke
    Then the command fails naming the failing viewport and horizontal scroll

  Scenario: Canvas is excluded from the document browser smoke test
    Given a Canvas HTML recipe
    When the agent runs the artifact script with smoke
    Then the command fails pointing the author to the Canvas ship gate
