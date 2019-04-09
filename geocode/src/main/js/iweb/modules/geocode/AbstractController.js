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
define(['ext', 'ol', "iweb/modules/MapModule", "iweb/modules/drawmenu/Interactions"], 
	function(Ext, ol, MapModule, Interactions){
	
		//a shared activeLayer
		var activeLayer;
	
		return Ext.define('modules.geocode.AbstractController', {
			extend : 'Ext.app.ViewController',
			
			alias: 'controller.geocode.abstractcontroller',
			
			onWindowClose: function() {
				this.removeLayer();
			},
			
			onDeactivate: function() {
				this.untoggleLocate();
			},
			
			onLocateToggle: function(btn, state) {
				if (!state) {
					MapModule.getMapController().setInteractions(this.previousInteractions);
					return;
				}
				
				this.previousInteractions = MapModule.getMapController().getInteractions();
				
				var source = this.getLayer().getSource();
				var style = this.getLayer().getStyle();
				var interaction = Interactions.drawPoint(source, style);
				interaction.on("drawend", this.onDrawEnd.bind(this));
				MapModule.getMapController().setInteractions([interaction]);
			},
			
			untoggleLocate: function() {
				var locateButton = this.lookupReference('locateButton');
				if(locateButton)
					this.lookupReference('locateButton').toggle(false);
			},
			
			onDrawEnd: function (drawEvent) {
				this.untoggleLocate();
				
				if (this.onLocateCallback) {
					this.onLocateCallback(drawEvent.feature);
				}
			},
			
			buildPoint: function(coord, view) {
				return new ol.geom.Point(coord)
					.transform(ol.proj.get('EPSG:4326'), view.getProjection());
			},
			
			buildFeature: function(geometry, address) {
				var feature = new ol.Feature({
					geometry: geometry,
					type: 'Geocoded Location',
					description: address
				});
				return feature;
			},
			
			buildStyle: function() {
				return new ol.style.Style({
					image: new ol.style.Circle({
						radius: 7,
						fill: new ol.style.Fill({
							color: 'rgba(255, 204, 51, 0.8)'
						}),
						stroke: new ol.style.Stroke({
							color: 'black',
							width: 1
						}),
					})
				})
			},
			
			getLayer: function() {
				if (!activeLayer) {
					activeLayer = new ol.layer.Vector({
						source: new ol.source.Vector(),
						style: this.buildStyle()
					});
					MapModule.getMapController().addLayer(activeLayer);
				}
				return activeLayer;
			},
			
			plotFeature: function(feature){
				this.getLayer().getSource().addFeature(feature);
			},
			
			removeLayer: function() {
				if (activeLayer) {
					MapModule.getMapController().removeLayer(activeLayer);
					activeLayer = null;
				}
			},

			resetInteractions: function() {
				var actions = MapModule.getMapController().getDefaultInteractions();
				MapModule.getMapController().setInteractions(actions);
			}
		});
});
