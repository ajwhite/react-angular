import React from 'react';
import omit from 'lodash.omit';
import compose from './compose';
import $inject from './inject';
import {withScope} from './scopeProvider';
import {runInApply} from './digest';

const connect = compose(
  $inject('$compile'),
  withScope
);

/**
 * Make an angular component renderable within a React component.
 *
 * Example:
 * ```
 * angular.module('yourApp')
 *  .component('fooBar', {
 *    ...
 *  })
 *
 * const FooBar = reactify('foo-bar');
 *
 * function YourReactComponent () {
 *   return (
 *     <FooBar value="'hello world'" />
 *   )
 * }
 * ```
 *
 * @param {string} componentName The kebab-cased angular component name
 * @returns {Function} The React component interface of the angular component.
 */
export default function reactify(componentName) {
  class ReactifiedComponent extends React.Component {
    /**
     * Gets the props that will be forwarded to the angular component.
     *
     * @return {Object} The props for the angular component.
     */
    getForwardProps() {
      return omit(this.props, ['$scope', '$compile', '$injector']);
    }

    /**
     * Gets the attributes that should be applied to the angular DOM element.
     * These attributes are rewritten from key=value to key=key. The value
     * will be stored in the $scope, indexed by the key.
     *
     * @return {Object} The angular component attributes.
     */
    getAngularAttributes() {
      return Object.keys(this.getForwardProps()).reduce((attrs, key) => {
        attrs[key] = key;
        return attrs;
      }, {});
    }

    /**
     * Updates the angular component's state when the React props change.
     *
     * @returns {void}
     */
    componentDidUpdate(prevProps) {
      const {$scope} = this.props;
      if ($scope) {
        // Write any property changes to the angular component's compiled scope.
        runInApply(
          $scope,
          () => Object.assign($scope, this.getForwardProps())
        )
      }
    }

    /**
     * Compile the angular component when the DOM reference from React is created.
     *
     * @param {?Object} ref The DOM element reference.
     * @returns {void}
     */
    compileReactRefIntoAngularComponent = (ref) => {
      if (ref) {
        const {$scope, $compile} = this.props;

        // Write the properties onto the $scope that will be used to
        // compile the angular component
        let props = this.getForwardProps();
        // `withScope` provides us with a new, isolated scope, so we are free to modify it/assign values.
        Object.assign($scope, props)

        // Compile the React reference to the underlying DOM element
        // with the scope to create an angular component.
        $compile(ref)($scope);
      }
    }

    render() {
      // React creates the DOM element of the component name.
      // We'll then $compile this with angular's $scope.
      return React.createElement(componentName, {
        // Pass the attributes to the angular component.
        // Eg: foo="bar" will become foo="foo", and "bar" will be added to
        // $scope.foo = "bar", where it will become compiled with the scope during the `ref` lifecycle.
        ...this.getAngularAttributes(),

        // Compile the angular component with $scope
        // IMPORTANT: the function passed to `ref` must be the same instance across renders
        ref: this.compileReactRefIntoAngularComponent
      });
    }
  }
  return connect(ReactifiedComponent);
}
