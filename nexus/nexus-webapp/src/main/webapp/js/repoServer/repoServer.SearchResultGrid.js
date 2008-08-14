/*
 * Nexus: Maven Repository Manager
 * Copyright (C) 2008 Sonatype Inc.                                                                                                                          
 * 
 * This file is part of Nexus.                                                                                                                                  
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/.
 *
 */
// must pass in feedUrl that's local to our domain, 'cause we ain't got no proxy yet

// config: feedUrl required

Sonatype.repoServer.SearchResultGrid = function(config) {

  Ext.apply(this, config);

  var resultRecordConstructor = Ext.data.Record.create([
      {name:'groupId'},
      {name:'artifactId'},
      {name:'version'},
      {name:'repoId'},
      {name:'resourceURI'},
      {name:'contextId'},
      {name:'classifier'}
  ]);

  var resultReader = new Ext.data.JsonReader({
      root: 'data',
      totalProperty: 'totalCount'
    },
    resultRecordConstructor );

  var requestProxy = new Ext.data.HttpProxy({
    url: Sonatype.config.repos.urls.index,
    method: 'GET'
    //headers: {Accept: 'application/json'}
  });
  
  this.totalRecords = 0;
  
  //@todo: create stand alone data reader to read update/create responses as well
  //@ext: must use data.Store (not JsonStore) to pass in reader instead of using fields config array
  this.store = new Ext.data.Store({
    proxy: requestProxy,
    reader: resultReader,
    listeners: {
      'beforeload': {
        fn: function( store, options ) {
          requestProxy.getConnection().on( 'requestcomplete',
            function( conn, response, options ) {
              if ( response.responseText ) {
                var statusResp = Ext.decode(response.responseText);
                if ( statusResp ) {
                  this.totalRecords = statusResp.totalCount;
                }
              }
            }, this, { single: true } );
          return true;
        },
        scope: this
      },
      'load': {
        fn: function( store, records, options ) {
          this.updateRowTotals( this );
        },
        scope: this
      }
    }
  });
  
  this.store.setDefaultSort('groupId', "ASC");

  this.columns = [
    {
      id: 'source',
      header: "Source Index",
      dataIndex: 'contextId',
      width: 100,
      sortable:true
    }/*,{
      id: 'repository',
      header: "Repository",
      dataIndex: 'repoId',
      width: 195,
      sortable:true
    }*/,{
      id: 'group',
      header: "Group",
      dataIndex: 'groupId',
      sortable:true,
      width: 145
    },{
      id: 'artifact',
      header: "Artifact",
      dataIndex: 'artifactId',
      width: 200,
      sortable:true
    },{
      id: 'version',
      header: "Version",
      dataIndex: 'version',
      width: 55,
      sortable:true
    },{
      id: 'classifier',
      header: "Classifier",
      dataIndex: 'classifier',
      width: 55,
      sortable:true
    },{
      id: 'jar',
      header: "Link",
      dataIndex: 'resourceURI',
      width: 65,
      sortable:false,
      renderer: this.formatJarLink
    }
//@note: NX-444 remove POM link functionality until it can work across browsers (firefix issue presently)
//  ,{
//    id: 'pom',
//    header: "POM Dependecy",
//    dataIndex: 'artifactId',
//    width: 105,
//    sortable:true,
//    renderer: this.formatPomLink
//  }
  ];

  this.fetchMoreButton = new Ext.SplitButton({
    text: 'Fetch Next 50',
    icon: Sonatype.config.resourcePath + '/images/icons/search.gif',
    cls: 'x-btn-text-icon',
    value: '50',
    handler: this.fetchMoreRows,
    disabled: true,
    scope: this,
    menu: {
      items: [
        {
          text: 'Fetch Next 50',
          value: '50',
          scope: this,
          handler: this.fetchMoreRows
        },
        {
          text: 'Fetch Next 100',
          value: '100',
          scope: this,
          handler: this.fetchMoreRows
        },
        {
          text: 'Fetch Next 200',
          value: '200',
          scope: this,
          handler: this.fetchMoreRows
        },
        {
          text: 'Fetch All',
          value: '0',
          scope: this,
          handler: this.fetchMoreRows
        }
      ]
    }
    
  });

  this.clearButton = new Ext.Button({
    text: 'Clear Results',
    icon: Sonatype.config.resourcePath + '/images/icons/clear.gif',
    cls: 'x-btn-text-icon',
    handler: this.clearResults,
    disabled: true,
    scope: this
  });

  this.fetchMoreBar = new Ext.Toolbar({
    ctCls: 'search-all-tbar',
    items: [ 
      'Displaying 0 of 0 records',
      this.fetchMoreButton,
      { xtype: 'tbspacer' },
      this.clearButton
    ]
  });

  Sonatype.repoServer.SearchResultGrid.superclass.constructor.call(this, {
      region: 'center',
      id: 'search-result-grid',
      loadMask: {msg:'Loading Results...'},
      stripeRows: true,
      sm: new Ext.grid.RowSelectionModel({
          singleSelect: true
      }),
      
      bbar: this.fetchMoreBar,

      viewConfig: {
          forceFit:true,
          enableRowBody:true,
          getRowClass : this.applyRowClass
      },
      
      listeners: {
        render: function(panel){
          panel.body.on(
            {
              'mousedown': function(e, t){
                var i = t.getAttribute('index');
                this.toggleExtraInfo(parseInt(i, 10));
                e.stopEvent();
                return false;
              },
              'click' : function(e, t){
                e.stopEvent();
                return false;
              },
              delegate:'a.pom-link',
              scope:panel
            });
        }
      }
  });
};

Ext.extend(Sonatype.repoServer.SearchResultGrid, Ext.grid.GridPanel, {
  toggleExtraInfo : function(rowIndex){
    var rowEl = new Ext.Element(this.getView().getRow(rowIndex));
    var input = rowEl.child('.copy-pom-dep', true);
    input.select(); //@todo: why won't this field highlight?!!!!
    rowEl.toggleClass('x-grid3-row-expanded');
  },

  // within this function "this" is actually the GridView
  applyRowClass: function(record, rowIndex, p, ds) {
    var xf = Ext.util.Format;
    var xmlDep = Sonatype.repoServer.RepoServer.pomDepTmpl.apply(record.data);
    //note: wrapper div with overflow:auto and autocomplete="off" are attempts to avoid a FF bug
    p.body = '<span>POM Dependency: </span><input class="copy-pom-dep" type="text" autocomplete="off" value="'+xmlDep+'"/>';
    return 'x-grid3-row-collapsed';
  },

  formatJarLink: function(value, p, record, rowIndex, colIndex, store) {
      return String.format('<a target="_blank" href="{0}">Download</a>', value);
  },
  
  formatPomLink: function(value, p, record, rowIndex, colIndex, store) {
      return '<a class="pom-link" index="'+rowIndex+'" href="#">View & Copy</a>';
  },

  fetchMoreRows: function( button, event ) {
    if ( button.value != this.fetchMoreButton.value ) {
      this.fetchMoreButton.value = button.value;
      this.fetchMoreButton.setText( button.text );
    }

    var fetched = this.store.getCount();
    var toFetch = this.fetchMoreButton.value;
    if ( toFetch == 0 ) {
      toFetch = this.totalRecords - fetched;
    }
    this.store.load({
      params: {
        from: fetched,
        count: toFetch
      },
      add: true
    });
  },
  
  updateRowTotals: function( p ) {
    var count = p.store.getCount();
    
    p.clearButton.setDisabled( count == 0 );
    
    if ( count == 0 || count > p.totalRecords ) {
      p.totalRecords = count;
    }
    
    p.fetchMoreBar.items.items[0].destroy();
    p.fetchMoreBar.items.removeAt( 0 );
    p.fetchMoreBar.insertButton( 0, new Ext.Toolbar.TextItem( 'Displaying ' + count + ' of ' + p.totalRecords + ' records' ) );

    p.fetchMoreButton.setDisabled( count >= p.totalRecords );
  },
  
  clearResults: function() {
    this.store.baseParams = {};
    this.store.removeAll();
    this.updateRowTotals( this );
  }
});