Feature: Handoff recording (one per version)
  A deploy that sets OPEN_ARTIFACTS_HANDOFF=1 lets a user with write access
  record a handoff: webcam + mic plus in-artifact mouse/click/scroll, stored as
  an R2 media blob + events JSON with D1 metadata. Each artifact VERSION keeps
  its own handoff; recording again for the SAME version overwrites that
  version's handoff in place, while recording for a DIFFERENT version keeps
  both. Any viewer can play it back. A deploy without the flag keeps today's
  viewer.

  Background:
    Given an instance with an artifact published at /a/<id>

  Scenario: Deploy without OPEN_ARTIFACTS_HANDOFF keeps today's viewer
    When the deploy has no OPEN_ARTIFACTS_HANDOFF flag
    Then GET /api/artifacts/<id>/handoffs returns 404
    And POST /api/artifacts/<id>/handoffs returns 404
    And GET /api/artifacts/<id>/handoffs/<hid>/media returns 404
    And the /a/<id> host page renders no "Handoff" button
    And the /a/<id>/frame document carries no handoff shim

  Scenario: Deploy with the flag renders the Handoff button
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    Then the /a/<id> host page renders a "Handoff" button
    And the /a/<id>/frame document carries the handoff shim (inert until armed)

  Scenario: Recording requires write access
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And a viewer without a write token POSTs a multipart handoff to /api/artifacts/<id>/handoffs
    Then the response is 401 (or 403)
    And nothing is written to R2 or D1

  Scenario: A recorded handoff is stored and round-trips
    When the owner POSTs a multipart handoff (media blob + events JSON + meta) to /api/artifacts/<id>/handoffs
    Then the response is 201 with {id, deleteToken}
    And the media blob is stored in R2 under handoff/<id>/<hid>/media
    And the events JSON is stored in R2 under handoff/<id>/<hid>/events
    And a handoffs row is inserted in D1
    And GET /api/artifacts/<id>/handoffs returns the handoff
    And GET /api/artifacts/<id>/handoffs/<hid>/media returns the bytes with the recorded content-type
    And GET /api/artifacts/<id>/handoffs/<hid>/events returns the events JSON

  Scenario: Recording again for the SAME version overwrites in place
    When the owner has already recorded a handoff for /a/<id> at version 1
    And the owner POSTs a second multipart handoff for version 1 to /api/artifacts/<id>/handoffs
    Then the response is 201 with the same {id} (version-scoped, reused)
    And GET /api/artifacts/<id>/handoffs returns only the second handoff
    And the first handoff's media and events are overwritten at the same R2 keys

  Scenario: Recording for a DIFFERENT version keeps both handoffs
    When the owner has recorded a handoff for /a/<id> at version 1
    And the owner publishes a second version of the artifact
    And the owner POSTs a handoff for version 2 to /api/artifacts/<id>/handoffs
    Then the response is 201 with a distinct {id} from the version-1 handoff
    And GET /api/artifacts/<id>/handoffs returns both handoffs
    And the version-1 handoff's media is untouched at its R2 keys

  Scenario: The host page inlines the recording matching the viewed version
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And handoffs exist for versions 1 and 2 of the artifact
    Then GET /a/<id>?v=1 embeds the version-1 handoff metadata as JSON
    And GET /a/<id>?v=2 embeds the version-2 handoff metadata as JSON
    So the play UI offers the right recording with no runtime fetch from the sandboxed frame

  Scenario: A portrait-blur recording stores the hasBlur flag
    When the owner POSTs a handoff whose meta includes hasBlur:true
    Then the response is 201 and the handoff row's has_blur is 1
    And GET /api/artifacts/<id>/handoffs returns hasBlur:true
    And the /a/<id> host page inlines hasBlur in the handoff JSON
    So playback knows not to re-composite an already-blurred clip

  Scenario: The circular camera preview stays stable while dragging
    Given a recording or playback shows the circular camera preview
    When the primary pointer drags the preview and another pointer also moves
    Then the preview follows only the primary pointer until release or cancel
    And switching between the raw camera and blur canvas does not steal the drag
    And the recording mirror remains active throughout the drag
    And the saved position is clamped inside the viewport after a resize

  Scenario: Opening Handoff previews the camera before recording
    Given the owner opens the Handoff dock while it is idle
    Then the circular camera shows a mirrored live preview without a recording ring
    And clicking Record reuses that media stream for the countdown and capture
    And closing the dock stops every camera and microphone track
    And a permission result arriving after close is stopped without being attached

  Scenario: Playback starts from the recorded page position
    Given the owner starts recording after scrolling the artifact
    Then the first interaction event stores that viewport position at t=0
    And later artifact scroll positions are stored in the event timeline
    When a viewer clicks Play from a different part of the artifact
    Then the artifact resets to the recorded starting position before playback advances
    And handoffs recorded before the t=0 event remain playable using their earliest scroll

  Scenario: Playback reads are view-gated like the artifact
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And a handoff exists for a private artifact
    Then an unauthorized GET /api/artifacts/<id>/handoffs/<hid>/media returns 404
    And an unauthorized GET /api/artifacts/<id>/handoffs/<hid>/events returns 404

  Scenario: A handoff is deleted by its author delete-token or the owner write-token
    When the author DELETEs /api/artifacts/<id>/handoffs/<hid> with the delete token
    Then the response is 200 and the media+events+row are removed
    But a stranger DELETE without a token gets 401
    And a stranger DELETE with a wrong token gets 403

  Scenario: Deleting the artifact sweeps all its versions' handoffs
    When the owner DELETEs the artifact
    Then every version's handoff media and events are removed from R2
    And every handoffs row is removed from D1
