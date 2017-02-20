/**
 * Generated On: 2016-07-07
 * Class: GpxUtils
 * Description: Parse Gpx file to get [lat, lon, alt]
 */

import * as THREE from 'three';
import Fetcher from 'Core/Commander/Providers/Fetcher';
import GeoCoordinate, { UNIT } from 'Core/Geographic/GeoCoordinate';
import Lines from 'Renderer/Lines';
import Points from 'Renderer/Points';

function _gpxToWayPointsArray(gpxXML) {
    return gpxXML.getElementsByTagName('wpt');
}

function _gGpxToWTrackPointsArray(gpxXML) {
    return gpxXML.getElementsByTagName('trkpt');
}

function _gpxPtToCartesian(pt, ellipsoid) {
    var longitude = Number(pt.attributes.lon.nodeValue);
    var latitude = Number(pt.attributes.lat.nodeValue);
    var elevation = Number(pt.getElementsByTagName('ele')[0].childNodes[0].nodeValue);

    return ellipsoid.cartographicToCartesian(new GeoCoordinate(longitude, latitude, elevation, UNIT.DEGREE));
}

function _gpxToWayPointsMesh(gpxXML, ellipsoid) {
    var wayPts = _gpxToWayPointsArray(gpxXML);

    if (wayPts.length) {
        var colorPoint = new THREE.Color('rgb(0, 255, 0)');
        var points = new Points({
            useTexture: false,
            texture: 'data/strokes/pstar1.png',
            color: [colorPoint.r, colorPoint.g, colorPoint.b],
            opacity: 1.0,
        });

        for (var i = 0; i < wayPts.length; i++) {
            points.addPoint(_gpxPtToCartesian(wayPts[i], ellipsoid), colorPoint, 600.0);
        }

        points.process();

        return points;
    } else {
        return null;
    }
}

function _gpxToWTrackPointsMesh(gpxXML, ellipsoid) {
    var trackPts = _gGpxToWTrackPointsArray(gpxXML);

    if (trackPts.length) {
        var colorLine = new THREE.Color('rgb(255, 0, 0)');
        var line = new Lines({
            time: 1.0,
            linewidth: 100.0,
            texture: 'data/strokes/hway1.png',
            useTexture: false,
            opacity: 1.0,
            sizeAttenuation: true,
            color: [colorLine.r, colorLine.g, colorLine.b],
        });

        for (var k = 0; k < trackPts.length; k++) {
            line.addPoint(_gpxPtToCartesian(trackPts[k], ellipsoid));
        }

        line.process();

        return line;
    } else {
        return null;
    }
}

function _gpxToMesh(gpxXML, ellipsoid) {
    if (!gpxXML) {
        return undefined;
    }

    var gpxMesh = new THREE.Object3D();

    // Getting the track points
    var trackPts = _gpxToWTrackPointsMesh(gpxXML, ellipsoid);

    if (trackPts) {
        gpxMesh.add(trackPts);
    }

    // Getting the waypoint points
    var wayPts = _gpxToWayPointsMesh(gpxXML, ellipsoid);

    if (wayPts) {
        gpxMesh.add(wayPts);
    }

    return gpxMesh;
}

export default function loadGpx(urlFile, ellipsoid) {
    return Fetcher.xml(urlFile).then(gpxXML => _gpxToMesh(gpxXML, ellipsoid));
}

