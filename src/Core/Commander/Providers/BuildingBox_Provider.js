/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


/**
 * Generated On: 2015-10-5
 * Class: WMTS_Provider
 * Description: Fournisseur de données à travers un flux WMTS
 */


// TODO , will use WFS_Provider
import Provider from 'Core/Commander/Providers/Provider';
import WFS_Provider from 'Core/Commander/Providers/WFS_Provider';
import * as THREE from 'three';
import Ellipsoid from 'Core/Math/Ellipsoid';
import GeoCoordinate, { UNIT } from 'Core/Geographic/GeoCoordinate';
import Earcut from 'earcut';

function BuildingBox_Provider(options) {
    // Constructor

    // Provider.call( this,new IoDriver_XBIL());
    // this.cache         = CacheRessource();
    this.WFS_Provider = new WFS_Provider(options);
    this.geometry = null;
    this.geometryRoof = null;
    this.pivot = null;
    this.roadOn = true;
    this.rtcOn = true;
}

BuildingBox_Provider.prototype = Object.create(Provider.prototype);
BuildingBox_Provider.prototype.constructor = BuildingBox_Provider;


/**
 * Return url wmts MNT
 * @param {type} coWMTS : coord WMTS
 * @returns {Object@call;create.url.url|String}
 */
BuildingBox_Provider.prototype.url = function url(longitude, latitude, radius) {
    // var key    = "wmybzw30d6zg563hjlq8eeqb";
    // var key    = coWMTS.zoom > 11 ? "va5orxd0pgzvq3jxutqfuy0b" : "wmybzw30d6zg563hjlq8eeqb"; // clef pro va5orxd0pgzvq3jxutqfuy0b

    var key = '72hpsel8j8nhb5qgdh07gcyp';

    // var layer  = "BDTOPO_BDD_WLD_WGS84G:bati_remarquable,BDTOPO_BDD_WLD_WGS84G:bati_indifferencie"
    var serviceVersionRequestLayer = 'service=WFS&version=2.0.0&REQUEST=GetFeature&typeName=BDTOPO_BDD_WLD_WGS84G:bati_remarquable,BDTOPO_BDD_WLD_WGS84G:bati_indifferencie';

    var bottomLeft = new THREE.Vector2(longitude - radius, latitude - radius);
    var topRight = new THREE.Vector2(longitude + radius, latitude + radius);


    var url = `http://wxs.ign.fr/${key}/geoportail/wfs?${serviceVersionRequestLayer
        }&bbox=${bottomLeft.x},${bottomLeft.y},${topRight.x
        },${topRight.y},epsg:4326&outputFormat=json`;

    return url;
};

BuildingBox_Provider.prototype.getData = function getData(bbox, altitude) {
    return this.WFS_Provider.getData(bbox).then((data) => {
        this.generateMesh(data, bbox, altitude); // console.log(data);
        return this.geometry;
    });
};

BuildingBox_Provider.prototype.generateMesh = function generateMesh(elements, bbox, altitude) {
    var roofGeometry = new THREE.Geometry(); // for the roof
    var _geometry = new THREE.Geometry(); // for the walls
    var geometry = new THREE.Geometry(); // for the roof
    var suppHeight = 10; // So we don't cut the roof
    var ellipsoid = new Ellipsoid(new THREE.Vector3(6378137, 6356752.3142451793, 6378137));
    var features = elements.features;
    var altitude_ground = altitude - 1.5; // 35;  // truck height

    for (const feature of features) {
        const hauteur = (feature.properties.hauteur + suppHeight) || 0;
        const z_min = altitude_ground; // features[r].properties.z_min;  // altitude_ground // force altitude ground
        const polygon = feature.geometry.coordinates[0][0];

        const arrPoint2D = [];
        if (polygon.length > 2) {
            // VERTICES
            for (let j = 0; j < polygon.length - 1; ++j) {
                const pt2DTab = polygon[j]; // .split(' ');
                const p1 = new THREE.Vector3(parseFloat(pt2DTab[0]), 0, parseFloat(pt2DTab[1]));

                const coordCarto1 = new GeoCoordinate(p1.x, p1.z, z_min, UNIT.DEGREE);
                const coordCarto2 = new GeoCoordinate(p1.x, p1.z, z_min + hauteur, UNIT.DEGREE); // + Math.random(1000) );
                const pgeo1 = ellipsoid.cartographicToCartesian(coordCarto1); // {longitude:p1.z, latitude:p1.x, altitude: 0});
                const pgeo2 = ellipsoid.cartographicToCartesian(coordCarto2);

                const vector3_1 = new THREE.Vector3(pgeo1.x, pgeo1.y, pgeo1.z); // - x temporary, bug
                const vector3_2 = new THREE.Vector3(pgeo2.x, pgeo2.y, pgeo2.z);


                arrPoint2D.push(p1.z, p1.x);
                _geometry.vertices.push(vector3_1, vector3_2);
            }

            // FACES
            // indice of the first point of the polygon 3D
            for (let k = _geometry.vertices.length - ((polygon.length - 1) * 2); k < _geometry.vertices.length; k += 2) {
                let l = k; // % (pts2DTab.length);
                if (l > _geometry.vertices.length - 4) {
                    l = _geometry.vertices.length - ((polygon.length - 1) * 2);
                }
                _geometry.faces.push(new THREE.Face3(l, l + 1, l + 3));
                _geometry.faces.push(new THREE.Face3(l, l + 3, l + 2));
            }

            const ll = _geometry.vertices.length - ((polygon.length - 1) * 2);
            _geometry.faces.push(new THREE.Face3(ll, ll + 1, _geometry.vertices.length - 1));
            _geometry.faces.push(new THREE.Face3(ll, _geometry.vertices.length - 1, _geometry.vertices.length - 2));
        }

        //* *************** ROOF ****************************

        var triangles = Earcut(arrPoint2D);
        for (let w = 0; w < triangles.length; w += 3) {
            const pt1 = new THREE.Vector2(arrPoint2D[triangles[w] * 2], arrPoint2D[triangles[w] * 2 + 1]);
            const pt2 = new THREE.Vector2(arrPoint2D[triangles[w + 1] * 2], arrPoint2D[triangles[w + 1] * 2 + 1]);
            const pt3 = new THREE.Vector2(arrPoint2D[triangles[w + 2] * 2], arrPoint2D[triangles[w + 2] * 2 + 1]);
            const c1 = new GeoCoordinate(pt1.x, pt1.y, z_min + hauteur, UNIT.DEGREE);
            const c2 = new GeoCoordinate(pt2.x, pt2.y, z_min + hauteur, UNIT.DEGREE);
            const c3 = new GeoCoordinate(pt3.x, pt3.y, z_min + hauteur, UNIT.DEGREE);

            const pc1 = this.ellipsoid.cartographicToCartesian(c1); // {longitude:p1.z, latitude:p1.x, altitude: 0});
            const pc2 = this.ellipsoid.cartographicToCartesian(c2);
            const pc3 = this.ellipsoid.cartographicToCartesian(c3);

            roofGeometry.vertices.push(new THREE.Vector3(pc1.x, pc1.y, pc1.z));
            roofGeometry.vertices.push(new THREE.Vector3(pc2.x, pc2.y, pc2.z));
            roofGeometry.vertices.push(new THREE.Vector3(pc3.x, pc3.y, pc3.z));

            var face = new THREE.Face3(geometry.vertices.length - 3,
                                     geometry.vertices.length - 2,
                                     geometry.vertices.length - 1);
            geometry.faces.push(face);
        }
    }

    if (this.roadOn) {
        this.addRoad(_geometry, bbox, altitude_ground, ellipsoid);
    }

    _geometry.computeFaceNormals(); // WARNING : VERY IMPORTANT WHILE WORKING WITH RAY CASTING ON CUSTOM MESH
    geometry.computeFaceNormals();

    /*
        var matLambert = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.8});
        var _currentMeshForRoof  = new THREE.Mesh(_geometry, matLambert);// //geometryClickToGo,mat);
        gfxEngine().add3DScene(_currentMeshForRoof);
    */

    // Test if we return brute geometry or if we use local pivot (for useRTC)
    var firstPos = new THREE.Vector3();
    if (this.rtcOn) {
        firstPos = _geometry.vertices[0].clone();
        // create pivot from 1st pos vertex
        for (const vertice of _geometry.vertices) {
            vertice.sub(firstPos);
        }
        for (const vertice of geometry.vertices) {
            vertice.sub(firstPos);
        }
    }

    this.geometry = _geometry;
    this.pivot = firstPos;
    this.geometryRoof = geometry;

    return {
        geometry: _geometry,
        pivot: firstPos,
        geometryRoof: geometry,
    };
};


BuildingBox_Provider.prototype.addRoad = function addRoad(geometry, bbox, altitude_road, ellipsoid) {
    // Version using SIMPLE PLANE ROAD for Click and Go
    var ratio = 0.2;
    var roadWidth = (bbox.east() - bbox.west()) * ratio;
    var roadHeight = (bbox.north() - bbox.south()) * ratio;
    var pos = new THREE.Vector3((bbox.south() + bbox.north()) / 2,
        altitude_road, (bbox.west() + bbox.east()) / 2); // 48.8505774,  altitude_sol, 2.3348124);

    var coordCarto1 = new GeoCoordinate(pos.x - roadWidth, pos.z - roadHeight, altitude_road, UNIT.DEGREE);
    var coordCarto2 = new GeoCoordinate(pos.x - roadWidth, pos.z + roadHeight, altitude_road, UNIT.DEGREE);
    var coordCarto3 = new GeoCoordinate(pos.x + roadWidth, pos.z + roadHeight, altitude_road, UNIT.DEGREE);
    var coordCarto4 = new GeoCoordinate(pos.x + roadWidth, pos.z - roadHeight, altitude_road, UNIT.DEGREE);

    var pgeo1 = ellipsoid.cartographicToCartesian(coordCarto1);
    var pgeo2 = ellipsoid.cartographicToCartesian(coordCarto2);
    var pgeo3 = ellipsoid.cartographicToCartesian(coordCarto3);
    var pgeo4 = ellipsoid.cartographicToCartesian(coordCarto4);

    geometry.vertices.push(new THREE.Vector3(pgeo1.x, pgeo1.y, pgeo1.z));
    geometry.vertices.push(new THREE.Vector3(pgeo2.x, pgeo2.y, pgeo2.z));
    geometry.vertices.push(new THREE.Vector3(pgeo3.x, pgeo3.y, pgeo3.z));
    geometry.vertices.push(new THREE.Vector3(pgeo4.x, pgeo4.y, pgeo4.z));

    var len = geometry.vertices.length;
    geometry.faces.push(new THREE.Face3(len - 4, len - 3, len - 2));
    geometry.faces.push(new THREE.Face3(len - 4, len - 2, len - 1));
};


export default BuildingBox_Provider;
