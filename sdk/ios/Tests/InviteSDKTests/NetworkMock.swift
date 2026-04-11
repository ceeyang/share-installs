import Foundation
import XCTest

/// A URLProtocol that allows us to mock responses for URLSession.
final class NetworkMock: URLProtocol {
    static var mockHandler: ((URLRequest) throws -> (HTTPURLResponse, Data?))?

    override class func canInit(with request: URLRequest) -> Bool {
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        guard let handler = NetworkMock.mockHandler else {
            XCTFail("mockHandler is not set")
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(this, didReceive: response, cacheStoragePolicy: .notAllowed)
            if let data = data {
                client?.urlProtocol(this, didLoad: data)
            }
            client?.urlProtocolDidFinishLoading(this)
        } catch {
            client?.urlProtocol(this, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

/// Helper to configure URLSession with NetworkMock
extension URLSessionConfiguration {
    static var mock: URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [NetworkMock.self]
        return config
    }
}
