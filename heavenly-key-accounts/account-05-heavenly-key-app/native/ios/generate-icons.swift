import AppKit
import Foundation
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = root.appendingPathComponent("../../source/public/assets/ministry/logo.png")
guard let logo = NSImage(contentsOf: source) else { fatalError("Original ministry logo is missing") }
let folder = root.appendingPathComponent("Sources/Assets.xcassets/AppIcon.appiconset")
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
let specs: [(String, String, String)] = [
("iphone","20x20","2x"),("iphone","20x20","3x"),("iphone","29x29","2x"),("iphone","29x29","3x"),
("iphone","40x40","2x"),("iphone","40x40","3x"),("iphone","60x60","2x"),("iphone","60x60","3x"),
("ipad","20x20","1x"),("ipad","20x20","2x"),("ipad","29x29","1x"),("ipad","29x29","2x"),
("ipad","40x40","1x"),("ipad","40x40","2x"),("ipad","76x76","1x"),("ipad","76x76","2x"),
("ipad","83.5x83.5","2x"),("ios-marketing","1024x1024","1x")]
var images = [[String:String]]()
for (idiom, size, scale) in specs {
    let points = Double(size.components(separatedBy: "x")[0])!
    let multiplier = Double(scale.replacingOccurrences(of: "x", with: ""))!
    let pixels = Int(points * multiplier)
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB,
        bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor(calibratedRed: 1, green: 0.98, blue: 0.88, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: pixels, height: pixels)).fill()
    let side = CGFloat(pixels) * 0.8
    let ratio = min(side / logo.size.width, side / logo.size.height)
    let width = logo.size.width * ratio, height = logo.size.height * ratio
    logo.draw(in: NSRect(x: (CGFloat(pixels)-width)/2, y: (CGFloat(pixels)-height)/2, width: width, height: height))
    NSGraphicsContext.restoreGraphicsState()
    let filename = "\(idiom)-\(size)-\(scale).png"
    try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent(filename))
    images.append(["idiom":idiom,"size":size,"scale":scale,"filename":filename])
}
let manifest: [String:Any] = ["images":images,"info":["version":1,"author":"xcode"]]
try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
    .write(to: folder.appendingPathComponent("Contents.json"))
