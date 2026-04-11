import XCTest
@testable import InviteSDK

final class KeychainTests: XCTestCase {
    
    func testGetOrCreateGeneratesIdenticalUUID() {
        let uuid1 = KeychainUUID.getOrCreate()
        let uuid2 = KeychainUUID.getOrCreate()
        
        XCTAssertFalse(uuid1.isEmpty)
        XCTAssertEqual(uuid1, uuid2, "Keychain should return the same UUID on subsequent calls")
    }
    
    // Note: On macOS unit tests (without app host), SecItemCopyMatching 
    // might fail with errSecInteractionNotAllowed or errSecMissingEntitlement.
    // This test ensures the logic handles the API surface correctly.
}
