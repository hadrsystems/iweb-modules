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
define(["iweb/CoreModule", "ol", "./MapStyle", "./FilteredCollection"],

	function(Core, ol, StyleMap, FilteredCollection) {

	var drawingLayer;
	var styleMap;

	var MapController = function(view, style, options){
		this.view = view;

	    this.mediator = Core.Mediator.getInstance();

	    this.interactions = null;//current control

	    styleMap = style;

	    drawingSource = new ol.source.Vector({
				wrapX: false
			});
	    drawingLayer = new ol.layer.Vector({
		  source: new ol.source.Vector(),
		  style: this.getStyle
		});

		this.view.map.addLayer(drawingLayer);

		select = new ol.interaction.Select({
			style: this.getSelectStyle,
			wrapX: false
		});

		move = new ol.interaction.DragMove({
			features: this.getEditableSelection(),
			style: this.getSelectStyle,
			draggingClass: null
		});

		this.setSource(drawingLayer.getSource()); //current drawing source

        this.drawingColor = "#000000";

        // change mouse cursor when over feature
        var map = this.view.map;
        this.view.map.on('pointermove', function(e) {

        	var pixel = map.getEventPixel(e.originalEvent);
        	var hit = map.hasFeatureAtPixel(pixel);
        	var el = Ext.fly(map.getTarget());

            if (e.dragging) {
            	el.addCls("ol-dragging");
            } else {
            	el.removeCls("ol-dragging");
            }

            if (hit) {
            	el.addCls("ol-hover-feature");
            } else {
            	el.removeCls("ol-hover-feature");
            }
        });

        this.view.map.on("click", function(e) {
  		  Core.EventManager.fireEvent("map-view-click", e);
  		});
	};

	MapController.prototype.bindEvents = function(){
		//on selection add/remove, fire change events
		var selectedCollection = select.getFeatures();
		selectedCollection.on(["add", "remove"], Ext.Function.createBuffered(function() {
			Core.EventManager.fireEvent("map-selection-change", selectedCollection.getArray().slice());
		}, 0));

		drawingSource.on('addfeature', this.drawingSourceAdd, this);
		drawingSource.on('removefeature', this.drawingSourceRemove, this);
	};

	MapController.prototype.setBaseLayer = function(layer){
		this.view.map.getLayers().setAt(0, layer);

		Core.EventManager.fireEvent("map-layer-setbase", layer);
	};

	MapController.prototype.zoomToExtent = function(extent){
		this.view.map.getView().fit(extent,this.view.map.getSize());
	};

	MapController.prototype.zoomTo = function(zoom){
        this.view.map.getView().setZoom(zoom); // TODO:need to test for max/min zoom level for current map first
    };

	MapController.prototype.getZoom = function(){
        return this.view.map.getView().getZoom();
    };

	MapController.prototype.addLayer = function(layer){
		this.view.map.addLayer(layer);

		Core.EventManager.fireEvent("map-layer-add", layer);
	};

	MapController.prototype.removeLayer = function(layer){
		this.view.map.removeLayer(layer);

		Core.EventManager.fireEvent("map-layer-remove", layer);
	};

	MapController.prototype.getSelectStyle = function(feature, resolution){
		return styleMap.getStyle(feature, resolution, true);
	};

	MapController.prototype.getStyle = function(feature, resolution){
		return styleMap.getStyle(feature, resolution);
	};

	MapController.prototype.getDefaultInteractions = function(){
		return [select, move];
	};

	MapController.prototype.getSelectInteraction = function(){
		return select;
	};

	MapController.prototype.getSelection = function(){
		return select.getFeatures();
	};

	MapController.prototype.getEditableSelection = function(){
		return new FilteredCollection(select.getFeatures(), function(feature){
			//ensure the feature is on the active source
			return drawingSource.getFeatures().indexOf(feature) >= 0;
		});
	};

	MapController.prototype.getInteractions = function(){
		return this.view.map.getInteractions().getArray().slice();
	};

	MapController.prototype.setInteractions = function(interactions){
		this.interactions = setInteractions(this.view.map, interactions, this.interactions);
		Core.EventManager.fireEvent("iweb.map.interactions.change", interactions);
	};

	/** Source for Drawing Layer **/
	MapController.prototype.getSource = function(){
		return drawingSource;
	};

	/** Source for Drawing Layer **/
	MapController.prototype.setSource = function(source){
		var oldSource = this.currentDrawingSource;
		if(oldSource){
			this.unbindSourceEvents(oldSource);
			this.currentDrawingSource = null;
		}

		drawingSource.clear();
		select.getFeatures().clear();

		if(source){
			drawingSource.addFeatures(source.getFeatures());

			this.currentDrawingSource = source;
			this.bindSourceEvents(source, select);
		}

		Core.EventManager.fireEvent("map-source-set", oldSource, source);
	};

	MapController.prototype.setDrawingColor = function(color){
		this.drawingColor = color;

		Core.EventManager.fireEvent("map-color-change", color);
	};

	MapController.prototype.getDrawingColor = function(){
		return this.drawingColor;
	};

	MapController.prototype.getDetailOverlay = function(){
		return this.view.popupOverlay;
	};

	MapController.prototype.bindSourceEvents = function(source){
		source.on('addfeature', this.currentSourceAdd, this);
		source.on('removefeature', this.currentSourceRemove, this);
	};

	MapController.prototype.unbindSourceEvents = function(source){
		source.un('addfeature', this.currentSourceAdd, this);
		source.un('removefeature', this.currentSourceRemove, this);
	};

	var setInteractions = function(map, newActions, oldActions){
		if(oldActions){
			oldActions.forEach(map.removeInteraction, map);
		}
		if(newActions){
			newActions.forEach(map.addInteraction, map);
		}
		return newActions;
	};

	MapController.prototype.drawingSourceAdd = function(evt) {
		var feature = evt.feature;
		if (this.currentDrawingSource && !feature.mapControllerSyncing) {
			feature.mapControllerSyncing = true;
			this.currentDrawingSource.addFeature(feature);
			delete feature.mapControllerSyncing;
		}
	};

	MapController.prototype.currentSourceAdd = function(evt) {
		var feature = evt.feature;
		if (!feature.mapControllerSyncing) {
			feature.mapControllerSyncing = true;
			drawingSource.addFeature(feature);
			delete feature.mapControllerSyncing;
		}
	};

	MapController.prototype.drawingSourceRemove = function(evt) {
		var feature = evt.feature;

		//the select interaction does not detect removed features, they stay selected
		//https://github.com/openlayers/ol3/issues/2485
		select.getFeatures().remove(feature);

		if (this.currentDrawingSource && !feature.mapControllerSyncing) {
			feature.mapControllerSyncing = true;
			this.currentDrawingSource.removeFeature(feature);
			delete feature.mapControllerSyncing;
		}
	};

	MapController.prototype.currentSourceRemove = function(evt) {
		var feature = evt.feature;
		if (!feature.mapControllerSyncing) {
			feature.mapControllerSyncing = true;
			drawingSource.removeFeature(feature);
			delete feature.mapControllerSyncing;
		}
	};

	MapController.prototype.getMap = function(){
		return this.view.map;
	};
	
	MapController.prototype.reloadLayer = function(layer){
		if(layer){
			var source = layer.getSource();

			var deferReload = source.get("deferReload");
			if (deferReload) {
				var features = source.getFeatures();
				source.clear();
				source.addFeatures(features);
			} else if(source && source.getParams){
				var params = source.getParams();
				if(!params){ params = {}; }
				params.updated = (new Date()).getTime();
				source.updateParams(params);
				if(params.LAYERS && 
						params.LAYERS.indexOf("show") > -1){ //Refresh ArcGis differently
					source.setTileLoadFunction(source.getTileLoadFunction());
				}
			}else if(source && source.clear){
				source.clear();
			}
		}
	};

	return MapController;
});
