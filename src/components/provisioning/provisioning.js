import * as React from 'react';
import PropTypes from 'prop-types';
import { noop } from 'patternfly-react';
import {
  EmptyState,
  EmptyStateIcon,
  DataList,
  DataListItem,
  DataListCell,
  Page,
  PageSection,
  PageSectionVariants,
  Progress,
  ProgressMeasureLocation,
  ProgressSize,
  Title
} from '@patternfly/react-core';
import { BoxesIcon, CheckCircleIcon, CircleNotchIcon } from '@patternfly/react-icons';
import get from 'lodash.get';
import { connect } from '../../redux';
import {
  PROVISION_SERVICES,
  getCustomConfig,
  manageMiddlewareServices,
  mockMiddlewareServices,
  getProductDetails
} from '../../services/middlewareServices';
import { currentUser } from '../../services/openshiftServices';
import {
  isServiceProvisioned,
  isServiceProvisioning,
  isServiceProvisionFailed
} from '../../common/walkthroughServiceHelpers';

function buildProvisioningScreen(WrappedComponent) {
  class Provisioning extends React.Component {
    state = { servicesToProvision: PROVISION_SERVICES };

    componentDidMount() {
      const { getCustomConfigForUser, manageWalkthroughServices, mockWalkthroughServices } = this.props;
      if (window.OPENSHIFT_CONFIG.mockData) {
        getCustomConfigForUser({ username: 'mockUser' }).then(() =>
          mockWalkthroughServices(window.OPENSHIFT_CONFIG.mockData)
        );
        return;
      }
      currentUser().then(user => {
        getCustomConfigForUser(user).then(config => {
          this.setState({ servicesToProvision: config.servicesToProvision });
          manageWalkthroughServices(user, config);
        });
      });
    }

    static areMiddlewareServicesReady(services, toProvision) {
      const servicesToProvision = toProvision || PROVISION_SERVICES;
      for (const svcName of servicesToProvision) {
        const svc = Provisioning.getServiceInstanceByClassName(services, svcName);
        if (!svc || !Provisioning.isMiddlewareServiceProvisioned(svc)) {
          return false;
        }
      }
      return true;
    }

    static getServiceInstanceByClassName(services, classToFind) {
      return services.find(svc => get(svc, 'spec.clusterServiceClassExternalName') === classToFind);
    }

    static isMiddlewareServiceProvisioned(svc) {
      if (svc.status && svc.status.conditions && svc.status.conditions[0]) {
        return svc.status.conditions[0].status === 'True';
      }
      return false;
    }

    static renderServiceLoadingIcon(svc) {
      if (isServiceProvisioned(svc)) {
        return (
          <div>
            <CheckCircleIcon className="integr8ly-provisioning-check" />
            <span className="integr8ly-provisioning-text pf-u-ml-sm"> Ready to use</span>
          </div>
        );
      }
      if (isServiceProvisioning(svc)) {
        return (
          <div className="integr8ly-provisioning-spinner">
            <CircleNotchIcon className="fa-spin" />{' '}
            <span className="integr8ly-provisioning-text pf-u-ml-sm"> Provisioning</span>
          </div>
        );
      }
      if (isServiceProvisionFailed(svc)) {
        return <div className="pficon pficon-error-circle-o" />;
      }
      return null;
    }

    static renderServiceLoadingText(svc) {
      if (isServiceProvisioned(svc)) {
        return <div className="list-group-item-heading">Ready to use</div>;
      }
      if (isServiceProvisioning(svc)) {
        return <div className="list-group-item-heading">Provisioning</div>;
      }
      if (isServiceProvisionFailed(svc)) {
        return <div className="list-group-item-heading integr8ly-status-error">Error</div>;
      }
      return null;
    }

    static renderServiceLoadingBar(svc) {
      if (isServiceProvisioned(svc)) {
        return (
          <Progress
            className="pf-m-singleline integr8ly-provisioned-bar"
            value={100}
            measureLocation={ProgressMeasureLocation.outside}
            size={ProgressSize.lg}
          />
        );
      }
      if (isServiceProvisionFailed(svc)) {
        return (
          <div className="integr8ly-status-error">Unable to provision. Please contact your Red Hat representative.</div>
        );
      }
      if (isServiceProvisioning(svc)) {
        return (
          <Progress
            className="pf-m-singleline"
            value={60}
            measureLocation={ProgressMeasureLocation.outside}
            size={ProgressSize.lg}
          />
        );
      }
      return null;
    }

    static renderServiceStatusBar(svc) {
      const isProvisionFailed = isServiceProvisionFailed(svc);
      return (
        <DataListItem
          className={`${isProvisionFailed ? 'list-group-error-item' : null}`}
          key={svc.spec.clusterServiceClassExternalName}
        >
          <DataListCell className="pf-u-py-md">{Provisioning.renderServiceLoadingIcon(svc)}</DataListCell>
          <DataListCell className="pf-u-py-md">
            {Provisioning.renderServiceLoadingText(svc)}
            <div className={` ${isProvisionFailed ? 'integr8ly-status-error' : null}`}>
              {getProductDetails(svc).prettyName}
            </div>
          </DataListCell>
          <DataListCell className="pf-u-py-md">{Provisioning.renderServiceLoadingBar(svc)}</DataListCell>
        </DataListItem>
      );
    }

    static renderLoadingScreen(services) {
      return (
        <Page className="pf-u-h-100vh">
          <PageSection
            variant={PageSectionVariants.default}
            className="pf-u-display-flex pf-l-flex pf-m-column-tablet-plus pf-m-justify-content-space-between"
          >
            <div />
            <EmptyState className="pf-m-align-self-center">
              <EmptyStateIcon icon={BoxesIcon} />
              <Title size="lg">Provisioning services for your new environment.</Title>
            </EmptyState>
            <DataList className="pf-u-w-100" aria-label="Provisioned services datalist">
              {services.map(Provisioning.renderServiceStatusBar)}
            </DataList>
          </PageSection>
        </Page>
      );
    }

    render() {
      const { middlewareServices } = this.props;
      return (
        <div>
          {!Provisioning.areMiddlewareServicesReady(
            Object.values(middlewareServices.data),
            this.state.servicesToProvision
          ) && Provisioning.renderLoadingScreen(Object.values(middlewareServices.data))}
          {Provisioning.areMiddlewareServicesReady(
            Object.values(middlewareServices.data),
            this.state.servicesToProvision
          ) && <WrappedComponent />}
        </div>
      );
    }
  }

  Provisioning.propTypes = {
    manageWalkthroughServices: PropTypes.func,
    mockWalkthroughServices: PropTypes.func,
    middlewareServices: PropTypes.object,
    getCustomConfigForUser: PropTypes.func
  };

  Provisioning.defaultProps = {
    manageWalkthroughServices: noop,
    mockWalkthroughServices: noop,
    getCustomConfigForUser: noop,
    middlewareServices: { data: {} }
  };

  const mapDispatchToProps = dispatch => ({
    manageWalkthroughServices: (user, config) => manageMiddlewareServices(dispatch, user, config),
    mockWalkthroughServices: mockData => mockMiddlewareServices(dispatch, mockData),
    getCustomConfigForUser: user => getCustomConfig(dispatch, user)
  });

  const mapStateToProps = state => ({
    ...state.middlewareReducers
  });

  const ConnectedProvisioning = connect(
    mapStateToProps,
    mapDispatchToProps
  )(Provisioning);

  return ConnectedProvisioning;
}

export { buildProvisioningScreen as default, buildProvisioningScreen };
