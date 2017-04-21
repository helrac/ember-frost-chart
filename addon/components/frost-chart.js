/**
 * Component definition for the frost-chart component
 */

import Ember from 'ember'
const {A, Object: EmberObject, Logger, assign, get, isEmpty, run, inject} = Ember
import {task, timeout} from 'ember-concurrency'
import {PropTypes} from 'ember-prop-types'
import computed, {readOnly} from 'ember-computed-decorators'
import {Component} from 'ember-frost-core'
import ResizeAware from 'ember-resize/mixins/resize-aware'

import {linearScale} from '../helpers/d3-linear-scale'
import layout from '../templates/components/frost-chart'

export default Component.extend(ResizeAware, {

  // == Dependencies ==========================================================

  // == Keyword Properties ====================================================

  layout,
  resizeWidthSensitive: true,
  resizeHeightSensitive: true,

  // == PropTypes =============================================================

  propTypes: {
    // options
    xDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
    xRange: PropTypes.arrayOf(PropTypes.number),
    xScale: PropTypes.func,
    yDomain: PropTypes.arrayOf(PropTypes.number).isRequired,
    yRange: PropTypes.arrayOf(PropTypes.number),
    yScale: PropTypes.func,

    // state
    _chartState: PropTypes.EmberObject
  },

  getDefaultProps () {
    return {
      // options
      xScale: linearScale(),
      yScale: linearScale(),

      // state
      _chartState: EmberObject.create({
        axes: EmberObject.create({
          initialized: false,
          registered: null,
          rendered: null,
          x: EmberObject.create({
            alignment: null,
            firstTickMargin: null,
            height: null,
            lastTickMargin: null,
            renderedTicks: A(),
            ticks: null,
            tickHeight: null,
            width: null
          }),
          y: EmberObject.create({
            alignment: null,
            firstTickMargin: null,
            height: null,
            lastTickMargin: null,
            renderedTicks: A(),
            ticks: null,
            width: null
          })
        }),
        canvas: EmberObject.create({
          height: null,
          width: null
        }),
        chart: EmberObject.create({
          height: null,
          initialized: false,
          padding: EmberObject.create({
            bottom: null,
            left: null,
            right: null,
            top: null
          }),
          width: null
        }),
        domain: EmberObject.create({
          x: null,
          y: null
        }),
        range: EmberObject.create({
          x: null,
          y: null
        }),
        scale: EmberObject.create({
          x: null,
          y: null
        })
      })
    }
  },

  // == Computed Properties ===================================================

  // == Functions =============================================================

  _hasDynamicRange () {
    return !this.get('xRange') || !this.get('yRange')
  },

  _resize ({height, width}) {
    const didHeightChange = this.get('_chartState.chart.height') !== height
    const didWidthChange = this.get('_chartState.chart.width') !== width

    if (didHeightChange) {
      this.set('_chartState.chart.height', height)
    }

    if (didWidthChange) {
      this.set('_chartState.chart.width', width)
    }

    if (didHeightChange || didWidthChange) {
      this._setupCanvas()
    }
  },

  _setupCanvas () {
    const chartHeight = this.get('_chartState.chart.height')
    const xAxisHeight = this.get('_chartState.axes.x.height') || 0
    const yAxisFirstTickMargin = this.get('_chartState.axes.y.firstTickMargin') || 0
    const yAxisLastTickMargin = this.get('_chartState.axes.y.lastTickMargin') || 0
    this.set('_chartState.canvas.height', chartHeight - xAxisHeight - yAxisFirstTickMargin - yAxisLastTickMargin)

    const chartWidth = this.get('_chartState.chart.width')
    const yAxisWidth = this.get('_chartState.axes.y.width') || 0
    const xAxisFirstTickMargin = this.get('_chartState.axes.x.firstTickMargin') || 0
    const xAxisLastTickMargin = this.get('_chartState.axes.x.lastTickMargin') || 0
    this.set('_chartState.canvas.width', chartWidth - yAxisWidth - xAxisFirstTickMargin - xAxisLastTickMargin)

    this._setupRange()
  },

  _setupChart () {
    const $el = this.$()

    this.set('_chartState.chart.height', $el.height())
    this.set('_chartState.chart.padding.bottom', parseFloat($el.css('padding-bottom')))
    this.set('_chartState.chart.padding.left', parseFloat($el.css('padding-left')))
    this.set('_chartState.chart.padding.right', parseFloat($el.css('padding-right')))
    this.set('_chartState.chart.padding.top', parseFloat($el.css('padding-top')))
    this.set('_chartState.chart.width', $el.width())

    if (this.get('_chartState.axes.registered') === null) {
      this.set('_chartState.axes.registered', 0)
    }

    this.set('_chartState.chart.initialized', true)
  },

  _setupRange () {
    if (isEmpty(this.get('xRange'))) {
      this.set('_chartState.range.x', [0, this.get('_chartState.canvas.width')])
    }

    if (isEmpty(this.get('yRange'))) {
      this.set('_chartState.range.y', [this.get('_chartState.canvas.height'), 0])
    }
  },

  _setupProperties () {
    this.set('_chartState.domain.x', this.get('xDomain'))
    this.set('_chartState.domain.y', this.get('yDomain'))

    const xRange = this.get('xRange')
    if (xRange) {
      this.set('_chartState.range.x', xRange)
    }

    const yRange = this.get('yRange')
    if (yRange) {
      this.set('_chartState.range.y', yRange)
    }

    this.set('_chartState.scale.x', this.get('xScale'))
    this.set('_chartState.scale.y', this.get('yScale'))
  },

  _setupXAxis ({alignment, height, ticks, tickHeight, width}) {
    const renderedTicks = this.get('_chartState.axes.x.renderedTicks')
    const firstTickMargin = renderedTicks.get('firstObject.width') / 2
    const lastTickMargin = renderedTicks.get('lastObject.width') / 2

    this.get('_chartState.axes.x').setProperties({
      alignment,
      firstTickMargin,
      height,
      lastTickMargin,
      ticks,
      tickHeight,
      width: width - firstTickMargin - lastTickMargin
    })

    this.incrementProperty('_chartState.axes.rendered')

    const registeredAxes = this.get('_chartState.axes.registered')
    if (registeredAxes === 0 || this.get('_chartState.axes.rendered') === registeredAxes) {
      this._setupCanvas()
      this.set('_chartState.axes.initialized', true)
    }
  },

  _setupYAxis ({alignment, height, ticks, width}) {
    const renderedTicks = this.get('_chartState.axes.y.renderedTicks')
    const firstTickMargin = renderedTicks.get('firstObject.height') / 2
    const lastTickMargin = renderedTicks.get('lastObject.height') / 2

    this.get('_chartState.axes.y').setProperties({
      alignment,
      firstTickMargin,
      height: height - firstTickMargin - lastTickMargin,
      lastTickMargin,
      ticks,
      width
    })

    this.incrementProperty('_chartState.axes.rendered')

    const registeredAxes = this.get('_chartState.axes.registered')
    if (registeredAxes === 0 || this.get('_chartState.axes.rendered') === registeredAxes) {
      this._setupCanvas()
      this.set('_chartState.axes.initialized', true)
    }
  },

  // == Tasks =================================================================

  _resizeTask: task(function * ({height, width}) {
    yield timeout(1000 / 60) // 60FPS

    Ember.run.scheduleOnce('sync', this, this._resize.bind(this, {
      height,
      width
    }))
  }).keepLatest(),

  // == DOM Events ============================================================

  // == Lifecycle Hooks =======================================================

  didInsertElement () {
    this._super(...arguments)
    run.scheduleOnce('sync', this, this._setupChart)
  },

  didResize(width, height) {
    if (this._hasDynamicRange()) {
      this.get('_resizeTask').perform({height, width})
    }
  },

  init () {
    this._super(...arguments)
    run.scheduleOnce('sync', this, this._setupProperties)
  },

  // == Actions ===============================================================

  actions: {
    _dispatch (action) {
      const {type} = action
      switch (type) {
        case 'REGISTER_AXIS':
          this.incrementProperty('_chartState.axes.registered')
          break;
        case 'RENDERED_TICK':
          this.get(`_chartState.axes.${get(action, 'axis')}.renderedTicks`).addObject(get(action, 'tick'))
          break;
        case 'RENDERED_X_AXIS':
          Ember.run.scheduleOnce('sync', this, this._setupXAxis.bind(this, get(action, 'axis')))
          break;
        case 'RENDERED_Y_AXIS':
          Ember.run.scheduleOnce('sync', this, this._setupYAxis.bind(this, get(action, 'axis')))
          break;
        default:
          Logger.warn(`Unknown action type dispatched: ${type}`)
      }
    }
  }
})
