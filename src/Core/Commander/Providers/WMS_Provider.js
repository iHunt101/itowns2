/**
 * Generated On: 2015-10-5
 * Class: WMS_Provider
 * Description: Provides data from a WMS stream
 */


import WMTS_Provider, { computeTileWMTSCoordinates } from 'Core/Commander/Providers/WMTS_Provider';
import * as THREE from 'three';
import mE from 'Core/Math/MathExtended';
import BoundingBox from 'Scene/BoundingBox';
import { UNIT } from 'Core/Geographic/GeoCoordinate';

/**
 * Return url wmts MNT
 * @param {String} options.url: service base url
 * @param {String} options.layer: requested data layer
 * @param {String} options.format: image format (default: format/jpeg)
 * @returns {Object@call;create.url.url|String}
 */
function WMS_Provider(options) {
    WMTS_Provider.call(this, options);
}

WMS_Provider.prototype = Object.create(WMTS_Provider.prototype);

WMS_Provider.prototype.constructor = WMS_Provider;

WMS_Provider.prototype.url = function url(bbox, layer) {
    return this.customUrl(layer.customUrl, bbox);
};

WMS_Provider.prototype.customUrl = function customUrl(url, bbox) {
    const bboxDegS = `${bbox.south(UNIT.DEGREE)},${
                    bbox.west(UNIT.DEGREE)},${
                    bbox.north(UNIT.DEGREE)},${
                    bbox.east(UNIT.DEGREE)}`;

    const urld = url.replace('%bbox', bboxDegS);

    return urld;
};

WMS_Provider.prototype.preprocessDataLayer = function preprocessDataLayer(layer) {
    if (!layer.name)
        { throw new Error('layerName is required.'); }

    if (layer.bbox)
    {
        mE.arrayDegToRad(layer.bbox);
        layer.bbox = new BoundingBox(layer.bbox[0], layer.bbox[2], layer.bbox[1], layer.bbox[3]);
    }

    layer.format = layer.options.mimetype || 'image/png';
    layer.crs = layer.projection || 'EPSG:4326';
    layer.width = layer.heightMapWidth || 256;
    layer.version = layer.version || '1.3.0';
    layer.style = layer.style || '';
    layer.transparent = layer.transparent || false;
    layer.bbox = layer.bbox || new BoundingBox();
    layer.options = {};
    layer.options.tileMatrixSet = layer.tileMatrixSet || 'WGS84G';

    layer.customUrl = `${layer.url
                  }?SERVICE=WMS&REQUEST=GetMap&LAYERS=${layer.name
                  }&VERSION=${layer.version
                  }&STYLES=${layer.style
                  }&FORMAT=${layer.format
                  }&TRANSPARENT=${layer.transparent
                  }&BBOX=%bbox` +
                  `&CRS=${layer.crs
                  }&WIDTH=${layer.width
                  }&HEIGHT=${layer.width}`;
};

WMS_Provider.prototype.tileInsideLimit = function tileInsideLimit(tile, layer) {
    return tile.level > 2 && layer.bbox.intersect(tile.bbox);
};

WMS_Provider.prototype.getColorTexture = function getColorTexture(tile, layer, bbox, pitch) {
    if (!this.tileInsideLimit(tile, layer) || tile.material === null) {
        return Promise.resolve();
    }

    const url = this.url(bbox, layer);
    const result = { pitch };

    return this.getColorTextureByUrl(url).then((texture) => {
        result.texture = texture;
        result.texture.coordWMTS = tile.wmtsCoords[layer.options.tileMatrixSet][0];
        result.texture.bbox = bbox;
        return result;
    });
};

WMS_Provider.prototype.getXbilTexture = function getXbilTexture(tile, layer, bbox, pitch) {
    const url = this.url(bbox, layer);
    return this.getXBilTextureByUrl(url, pitch).then((result) => {
        result.texture.coordWMTS = tile.wmtsCoords[layer.options.tileMatrixSet][0];
        return result;
    });
};

WMS_Provider.prototype.executeCommand = function executeCommand(command) {
    const layer = command.layer;
    const tile = command.requester;

    computeTileWMTSCoordinates(tile, layer, this.projection);

    const supportedFormats = {
        'image/png': this.getColorTexture.bind(this),
        'image/jpg': this.getColorTexture.bind(this),
        'image/jpeg': this.getColorTexture.bind(this),
        'image/x-bil;bits=32': this.getXbilTexture.bind(this),
    };

    const func = supportedFormats[layer.format];
    if (func) {
        const searchInParent = tile.materials[0].getColorLayerLevelById(layer.id) < 0 && tile.parent.materials[0].getColorLayerLevelById(layer.id) > -1;
        let pitch = new THREE.Vector3(0, 0, 1);
        let bbox = tile.bbox;

        if (searchInParent) {
            const texture = tile.parent.material.getLayerTextures(layer.type, layer.id)[0];
            if (texture) {
                bbox = texture.bbox;
                pitch = this.projection.WMS_WGS84Parent(tile.bbox, bbox);
                return Promise.resolve({ pitch, texture });
            }
        }

        return func(tile, layer, bbox, pitch);
    } else {
        return Promise.reject(new Error(`Unsupported mimetype ${layer.format}`));
    }
};

export default WMS_Provider;
