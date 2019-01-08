/*
 * Copyright (c) 2008-2016, Massachusetts Institute of Technology (MIT)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(['ext', 'ol', "iweb/modules/MapModule", "./AbstractController",
		"async!https://maps.googleapis.com/maps/api/js?key=${google.api.key}"],
	function(Ext, ol, MapModule, AbstractController, Interactions){
	
		return Ext.define('modules.geocode.AddressController', {
			extend : 'modules.geocode.AbstractController',
			
			alias: 'controller.geocode.addresscontroller',
			
			onSearchClick: function() {
				var address = this.getView().getAddressInput().getValue();
				
				var geocoder = new google.maps.Geocoder();
				geocoder.geocode({'address': address}, this.geocodeCallback.bind(this));
			},
			
			geocodeCallback: function(results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					var loc = results[0].geometry.location;
					var viewport = results[0].geometry.viewport;
					var address = results[0].formatted_address;
					
					var map = MapModule.getMap();
					var view = map.getView();
					
					var point = this.buildPoint(loc, view);
					var feature = this.buildFeature(point, address);
					this.plotFeature(feature);
					
					var nePt = this.buildPoint(viewport.getNorthEast(), view);
					var swPt = this.buildPoint(viewport.getSouthWest(), view);
					var extent = ol.extent.boundingExtent([nePt.getCoordinates(), swPt.getCoordinates()]);
					MapModule.getMapController().zoomToExtent(extent);
				} else {
					Ext.Msg.alert('Address Geocode Error', 'Geocode was not successful for the following reason: ' + status);
				}
			},
			
			
			buildPoint: function(loc, view) {
				return new ol.geom.Point([loc.lng(), loc.lat()])
					.transform(ol.proj.get('EPSG:4326'), view.getProjection());
			},
			
			onLocateCallback: function(feature) {
				feature.setProperties({
					type: 'Geocoded Location'
				});
				
				var view = MapModule.getMap().getView();
				var clone = feature.getGeometry().clone()
					.transform(view.getProjection(), ol.proj.get('EPSG:4326'));
				var coord = clone.getCoordinates();
				
				var geocoder = new google.maps.Geocoder();
				geocoder.geocode({'location': {'lat': coord[1], 'lng': coord[0]}},
						this.reverseGeocodeCallback.bind(this, feature));
				
				var controller = MapModule.getMapController();
				controller.setInteractions(controller.getDefaultInteractions());
			},
			
			reverseGeocodeCallback: function(feature, results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					var address = results[0].formatted_address;
					
					this.getView().getAddressInput().setValue(address);
					feature.set("description", address);
				} else {
					Ext.Msg.alert('Address Geocode Error', 'Geocode was not successful for the following reason: ' + status);
				}
			}
		});
});
