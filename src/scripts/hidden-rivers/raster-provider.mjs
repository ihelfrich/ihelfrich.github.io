export function createRasterProvider(C,image,b,mercator=true,credit='Copernicus Sentinel-2 L2A'){
  const rect=C.Rectangle.fromDegrees(...b),projection=new C.WebMercatorProjection();
  const scheme=mercator?new C.WebMercatorTilingScheme({rectangleSouthwestInMeters:projection.project(C.Cartographic.fromDegrees(b[0],b[1])),rectangleNortheastInMeters:projection.project(C.Cartographic.fromDegrees(b[2],b[3]))}):new C.GeographicTilingScheme({rectangle:rect,numberOfLevelZeroTilesX:1,numberOfLevelZeroTilesY:1});
  // Reuse the scheme's round-tripped rectangle. A separately calculated one can
  // differ by an ulp, putting its own corners outside positionToTileXY bounds.
  return {url:'local georeferenced raster',tileWidth:image.width,tileHeight:image.height,minimumLevel:0,maximumLevel:0,tilingScheme:scheme,rectangle:scheme.rectangle,errorEvent:new C.Event(),credit:new C.Credit(credit),hasAlphaChannel:true,getTileCredits:()=>[],requestImage:()=>Promise.resolve(image),pickFeatures:()=>undefined};
}

export function createTiledRasterProvider(C,tiles,base='/hidden-rivers/water-atlas/'){
  const b=tiles.bounds,projection=new C.WebMercatorProjection();
  const scheme=new C.WebMercatorTilingScheme({rectangleSouthwestInMeters:projection.project(C.Cartographic.fromDegrees(b[0],b[1])),rectangleNortheastInMeters:projection.project(C.Cartographic.fromDegrees(b[2],b[3]))});
  return new C.UrlTemplateImageryProvider({url:base+tiles.url,tilingScheme:scheme,rectangle:scheme.rectangle,tileWidth:tiles.tileWidth,tileHeight:tiles.tileHeight,minimumLevel:0,maximumLevel:tiles.maximumLevel,credit:'Copernicus Sentinel-2 L2A · dated spectral raster',hasAlphaChannel:true});
}
