const templates = require('../../configs/templates');

const getAddViewScript = app => view => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const viewSchema = { ...view, ...(view.role ?? {}) };

	const viewData = {
		name: viewSchema.code || viewSchema.name,
		keys: getKeys(
			viewSchema,
			viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {},
			ddlProvider,
			app,
		),
		dbData: { databaseName: viewSchema.compMod.keyspaceName },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	return ddlProvider.createView(hydratedView, {}, view.isActivated);
};

const getDeleteViewScript = app => view => {
	const _ = app.require('lodash');
	const { getTableName } = require('../general')({ _ });
	const viewName = getTableName(view.code || view.name, view?.role?.compMod?.keyspaceName);

	return `DROP VIEW IF EXISTS ${viewName};`;
};

const getModifiedViewScript = app => view => {
	const _ = app.require('lodash');
	const { checkCompModEqual } = require('./common')(_);
	const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { getTableName } = require('../general')({ _ });
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const viewSchema = { ...view, ...(view.role ?? {}) };
	const viewData = {
		name: viewSchema.code || viewSchema.name,
		keys: getKeys(
			viewSchema,
			viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {},
			ddlProvider,
			app,
		),
		dbData: { databaseName: viewSchema.compMod.keyspaceName },
	};

	const isAlgorithmChanged = !checkCompModEqual(viewSchema.compMod?.algorithm, _);
	const isSqlSecurityChanged = !checkCompModEqual(viewSchema.compMod?.sqlSecurity, _);

	const { deactivatedWholeStatement, selectStatement } = ddlProvider.viewSelectStatement(
		viewData,
		viewSchema.isActivated,
	);

	const algorithm =
		viewSchema.algorithm && viewSchema.algorithm !== 'UNDEFINED'
			? ` ALGORITHM ${viewSchema.algorithm}`
			: 'ALGORITHM UNDEFINED';
	const sqlSecurity = viewData.sqlSecurity ? ` SQL SECURITY ${viewData.sqlSecurity}` : '';

	return commentIfDeactivated(
		assignTemplates(templates.alterView, {
			name: getTableName(viewData.name, viewData.dbData.databaseName),
			selectStatement,
			...(isSqlSecurityChanged && { sqlSecurity }),
			...(isAlgorithmChanged && { algorithm }),
		}),
		{ isActivated: !deactivatedWholeStatement },
	);
};

const getKeys = (viewSchema, collectionRefsDefinitionsMap, ddlProvider, app) => {
	const _ = app.require('lodash');
	const { mapProperties } = app.require('@hackolade/ddl-fe-utils');

	return mapProperties(viewSchema, (propertyName, schema) => {
		const definition = collectionRefsDefinitionsMap[schema.refId];

		if (!definition) {
			return ddlProvider.hydrateViewColumn({
				name: propertyName,
				isActivated: schema.isActivated,
			});
		}

		const entityName =
			_.get(definition.collection, '[0].code', '') ||
			_.get(definition.collection, '[0].collectionName', '') ||
			'';
		const dbName = _.get(definition.bucket, '[0].code') || _.get(definition.bucket, '[0].name', '');
		const name = definition.name;

		if (name === propertyName) {
			return ddlProvider.hydrateViewColumn({
				containerData: definition.bucket,
				entityData: definition.collection,
				isActivated: schema.isActivated,
				definition: definition.definition,
				entityName,
				name,
				dbName,
			});
		}

		return ddlProvider.hydrateViewColumn({
			containerData: definition.bucket,
			entityData: definition.collection,
			isActivated: schema.isActivated,
			definition: definition.definition,
			alias: propertyName,
			entityName,
			name,
			dbName,
		});
	});
};

module.exports = {
	getAddViewScript,
	getDeleteViewScript,
	getModifiedViewScript,
};
